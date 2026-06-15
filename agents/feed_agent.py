#!/usr/bin/env python3
"""
Runway Feed Agent
Scrapes Beatport and 1001Tracklists, supports manual YouTube input.
Stores matching items in Supabase feed_items table.

Genre limits:
  - Beatport: melodic-techno only (via Beatport genre slug "melodic-house-techno", ID 90)
  - 1001Tracklists: only tracklists tagged "techno" or "melodic techno"
  - YouTube: manual links, no genre filter

Usage:
    python agents/feed_agent.py --source beatport --limit 50
    python agents/feed_agent.py --source 1001tracklists --limit 30
    python agents/feed_agent.py --source youtube --urls "https://youtu.be/..."
"""

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from runway_client import RunwayClient

try:
    import cloudscraper
    from bs4 import BeautifulSoup
    HAS_SCRAPER = True
except ImportError:
    HAS_SCRAPER = False
    cloudscraper = None  # type: ignore
    BeautifulSoup = None  # type: ignore


class FeedAgent:
    """Fetch feed items from Beatport, 1001Tracklists and YouTube."""

    BEATPORT_GENRE_SLUG = "melodic-house-techno"
    BEATPORT_GENRE_ID = 90
    BEATPORT_GENRE_NAME = "melodic-techno"

    ALLOWED_1001_GENRES = {"techno", "melodic techno", "melodic house/techno"}

    def __init__(self, client: Optional[RunwayClient] = None):
        self.client = client or RunwayClient()
        self.scraper = cloudscraper.create_scraper() if HAS_SCRAPER and cloudscraper else None

    # ── Beatport ───────────────────────────────────────────────────────────────

    def fetch_beatport(self, max_items: int = 50) -> List[Dict[str, Any]]:
        """Fetch top-100 and new-releases for melodic techno, limited to past 7 days."""
        if not self.scraper:
            raise RuntimeError("cloudscraper and beautifulsoup4 are required for Beatport")

        results: List[Dict[str, Any]] = []
        seen_ids = set()
        cutoff = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

        pages = [
            ("top-100", f"https://www.beatport.com/genre/{self.BEATPORT_GENRE_SLUG}/{self.BEATPORT_GENRE_ID}/top-100"),
            ("new-releases", f"https://www.beatport.com/genre/{self.BEATPORT_GENRE_SLUG}/{self.BEATPORT_GENRE_ID}/top-100-releases"),
        ]

        for chart_type, url in pages:
            try:
                tracks = self._beatport_tracks_from_page(url)
            except Exception as e:
                print(f"[FeedAgent] Beatport {chart_type} failed: {e}")
                continue

            for track in tracks:
                tid = track.get("id")
                if tid in seen_ids:
                    continue
                seen_ids.add(tid)

                release_date = track.get("new_release_date") or track.get("publish_date") or ""
                if release_date and release_date < cutoff:
                    continue

                artists = track.get("artists") or []
                artist_name = ", ".join(a.get("name") or "" for a in artists if a.get("name"))
                label = (track.get("label") or {}).get("name") or ""

                results.append({
                    "source": "beatport",
                    "title": track.get("name") or "Unknown",
                    "artist": artist_name or None,
                    "url": f"https://www.beatport.com/track/{track.get('slug', '')}/{tid}/" if tid else None,
                    "genre": self.BEATPORT_GENRE_NAME,
                    "label": label or None,
                    "published_at": f"{release_date}T00:00:00Z" if release_date else datetime.now().isoformat(),
                    "processed": False,
                })

                if len(results) >= max_items:
                    return results[:max_items]

        return results[:max_items]

    def _beatport_tracks_from_page(self, url: str) -> List[Dict[str, Any]]:
        res = self.scraper.get(url, timeout=30)
        res.raise_for_status()
        html = res.text
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
        if not m:
            raise RuntimeError("No __NEXT_DATA__ found on Beatport page")
        data = json.loads(m.group(1))
        queries = data.get("props", {}).get("pageProps", {}).get("dehydratedState", {}).get("queries", [])
        for q in queries:
            results = q.get("state", {}).get("data", {}).get("results")
            if isinstance(results, list):
                return results
        return []

    # ── 1001Tracklists ─────────────────────────────────────────────────────────

    def fetch_1001tracklists(self, max_items: int = 30) -> List[Dict[str, Any]]:
        """Fetch trending tracklists from homepage and filter by techno/melodic techno, >=5 tracks."""
        if not self.scraper:
            raise RuntimeError("cloudscraper and beautifulsoup4 are required for 1001Tracklists")

        home = self.scraper.get("https://1001tracklists.com/", timeout=30)
        home.raise_for_status()
        soup = BeautifulSoup(home.text, "html.parser")

        results: List[Dict[str, Any]] = []
        seen = set()

        for item_div in soup.find_all("div", class_="bItm"):
            if len(results) >= max_items:
                break

            a = item_div.find("a", href=re.compile(r"/tracklist/"))
            if not a:
                continue
            href = a.get("href")
            if not href or href in seen:
                continue
            seen.add(href)

            url = f"https://1001tracklists.com{href}" if href.startswith("/") else href
            title = a.get_text(strip=True)
            full_text = item_div.get_text(strip=True, separator=" | ")

            # Genres are the last pipe-separated segment on the homepage item
            genres_text = ""
            parts = [p.strip() for p in full_text.split("|")]
            if parts:
                # Last meaningful part usually contains genres
                last = parts[-1]
                if "," in last and not last.endswith("m") and not last.endswith("k"):
                    genres_text = last

            genres = {g.strip().lower() for g in genres_text.split(",") if g.strip()}

            # Track count from text like all | /21 or 09/35
            track_count = None
            tc_m = re.search(r"\b(\d{1,3})\s*/\s*(\d{1,3})\b", full_text)
            if tc_m:
                track_count = int(tc_m.group(2))
            else:
                all_m = re.search(r"all\s*[|/\s]\s*/\s*(\d{1,3})", full_text)
                if all_m:
                    track_count = int(all_m.group(1))

            if (track_count or 0) < 5:
                continue

            matched_genres = {g for g in genres if any(allowed in g for allowed in self.ALLOWED_1001_GENRES)}
            if not matched_genres:
                continue

            # Date from text
            published_at = None
            date_m = re.search(r"(\d{4}-\d{2}-\d{2})", full_text)
            if date_m:
                published_at = f"{date_m.group(1)}T00:00:00"

            results.append({
                "source": "1001tracklists",
                "title": title or "Untitled Tracklist",
                "artist": None,
                "url": url,
                "genre": ", ".join(sorted(matched_genres)) or "techno",
                "label": None,
                "published_at": published_at or datetime.now().isoformat(),
                "processed": False,
            })

        return results[:max_items]

    def _parse_1001_tracklist(self, url: str) -> Optional[Dict[str, Any]]:
        res = self.scraper.get(url, timeout=30)
        res.raise_for_status()
        html = res.text
        soup = BeautifulSoup(html, "html.parser")

        title_tag = soup.find("h1")
        title = title_tag.get_text(strip=True) if title_tag else None

        # Genres from the "Tracklist Genre(s)" section
        genres = set()
        genre_heading = soup.find(string=re.compile(r"Tracklist Genre\(s\)"))
        if genre_heading:
            parent = genre_heading.find_parent()
            if parent:
                for a in parent.find_all("a", href=re.compile(r"/genre/")):
                    g = a.get_text(strip=True)
                    if g:
                        genres.add(g)
        # Fallback to meta description
        if not genres:
            m = re.search(r'Tracklist Genre\(s\)([^<]+)', html)
            if m:
                for g in m.group(1).split(","):
                    g = g.strip()
                    if g:
                        genres.add(g)

        # Track count from schema.org meta
        track_count = None
        m = re.search(r'<meta itemprop="numTracks" content="(\d+)">', html)
        if m:
            track_count = int(m.group(1))

        # Published date
        published_at = None
        date_m = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b', html)
        if date_m:
            try:
                published_at = datetime.strptime(f"{date_m.group(1)} {date_m.group(2)} {date_m.group(3)}", "%d %B %Y").isoformat()
            except ValueError:
                pass

        return {
            "title": title,
            "genres": sorted(genres),
            "track_count": track_count,
            "published_at": published_at,
        }

    # ── YouTube ────────────────────────────────────────────────────────────────

    @staticmethod
    def fetch_youtube_metadata(url: str) -> Optional[Dict[str, str]]:
        """Fetch title and channel from YouTube oEmbed."""
        try:
            encoded = urllib.parse.quote(url, safe="")
            oembed_url = f"https://www.youtube.com/oembed?url={encoded}&format=json"
            with urllib.request.urlopen(oembed_url, timeout=10) as resp:
                data = json.loads(resp.read().decode())
            return {
                "title": data.get("title") or url,
                "channel": data.get("author_name") or "Unknown",
            }
        except Exception as e:
            print(f"[FeedAgent] YouTube oEmbed failed for {url}: {e}")
            return None

    def create_youtube_items(self, urls: List[str]) -> List[Dict[str, Any]]:
        """Build feed_items from YouTube URLs."""
        items = []
        for url in urls:
            url = url.strip()
            if not url:
                continue
            meta = self.fetch_youtube_metadata(url)
            items.append({
                "source": "youtube",
                "title": meta.get("title") if meta else url,
                "artist": meta.get("channel") if meta else None,
                "url": url,
                "genre": None,
                "label": None,
                "published_at": datetime.now().isoformat(),
                "processed": False,
            })
        return items

    # ── Supabase persistence ───────────────────────────────────────────────────

    def save_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert feed items via RunwayClient. Skips duplicates by URL."""
        if not items:
            return []

        existing = self.client._request("GET", "feed_items", params={"select": "url"})
        existing_urls = {row.get("url") for row in (existing or []) if row.get("url")}

        new_items = [item for item in items if item.get("url") and item.get("url") not in existing_urls]
        if not new_items:
            print("[FeedAgent] No new items to save")
            return []

        saved = self.client._request("POST", "feed_items", new_items)
        print(f"[FeedAgent] Saved {len(saved)} new items")
        return saved


def main():
    parser = argparse.ArgumentParser(description="Runway Feed Agent")
    parser.add_argument("--source", required=True, choices=["beatport", "1001tracklists", "youtube", "all"])
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--urls", help="Comma-separated YouTube URLs (for --source youtube)")
    parser.add_argument("--save", action="store_true", help="Save results to Supabase")
    args = parser.parse_args()

    agent = FeedAgent()
    items: List[Dict[str, Any]] = []

    if args.source in ("beatport", "all"):
        items.extend(agent.fetch_beatport(max_items=args.limit))
    if args.source in ("1001tracklists", "all"):
        items.extend(agent.fetch_1001tracklists(max_items=args.limit))
    if args.source == "youtube":
        urls = [u.strip() for u in (args.urls or "").split(",") if u.strip()]
        if not urls:
            print("[FeedAgent] No YouTube URLs provided")
            return
        items.extend(agent.create_youtube_items(urls))

    if args.save:
        agent.save_items(items)

    print(json.dumps({"items": items, "count": len(items)}, indent=2, default=str))


if __name__ == "__main__":
    main()
