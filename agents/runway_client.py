#!/usr/bin/env python3
"""
Runway Supabase Client — Production Ready
All agents use this to read/write to the live Supabase database.
"""

import os
import json
import urllib.request
import urllib.parse
from datetime import datetime
from typing import List, Dict, Optional, Any

def _require_env(name: str) -> str:
    """Read a required environment variable."""
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value.strip()


class RunwayClient:
    """Production Supabase REST client for Runway agents."""

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None, service_key: Optional[str] = None):
        self.url = (url or _require_env("SUPABASE_URL")).rstrip("/")
        self.key = key or _require_env("SUPABASE_ANON_KEY")
        self.service_key = service_key or _require_env("SUPABASE_SERVICE_ROLE_KEY")

        # Service role headers for ALL operations (bypasses RLS)
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def _request(self, method: str, endpoint: str, data: Optional[dict] = None, 
                 params: Optional[dict] = None) -> Any:
        url = f"{self.url}/rest/v1/{endpoint}"
        if params:
            query = urllib.parse.urlencode(params)
            url = f"{url}?{query}"

        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode() if data else None,
            headers=self.headers,
            method=method
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"[RunwayClient] HTTP {e.code}: {error_body[:200]}")
            raise

    # --- PLAYLISTS ---

    def create_playlist(self, name: str, agent: str, service: str, 
                        external_id: str, track_count: int, prompt_name: str) -> dict:
        return self._request("POST", "playlists", {
            "name": name or "",
            "agent": agent or "",
            "service": service or "",
            "external_id": external_id or "",
            "track_count": track_count or 0,
            "prompt_name": prompt_name or "",
            "created_at": datetime.now().isoformat()
        })

    def get_playlists(self, agent: Optional[str] = None, service: Optional[str] = None) -> List[dict]:
        params = {"select": "*", "order": "created_at.desc"}
        if agent:
            params["agent"] = f"eq.{agent}"
        if service:
            params["service"] = f"eq.{service}"
        return self._request("GET", "playlists", params=params)

    def get_playlist_by_external_id(self, external_id: str) -> Optional[dict]:
        results = self._request("GET", "playlists", params={
            "select": "*",
            "external_id": f"eq.{external_id}",
            "limit": 1
        })
        return results[0] if results else None

    # --- TRACKS ---

    def create_track(self, title: str, artist: str, album: str, source: str,
                     isrc: Optional[str], discovered_by: str, prompt_name: str,
                     playlist_id: Optional[str] = None,
                     release_date: Optional[str] = None) -> dict:
        payload: Dict[str, Any] = {
            "title": title or "",
            "artist": artist or "",
            "album": album or "",
            "source": source or "",
            "isrc": isrc,
            "discovered_by": discovered_by or "",
            "discovered_at": datetime.now().isoformat(),
            "prompt_name": prompt_name or "",
            "playlist_id": playlist_id,
        }
        if release_date:
            payload["release_date"] = release_date
        return self._request("POST", "tracks", payload)

    def get_tracks(self, prompt_name: Optional[str] = None, discovered_by: Optional[str] = None) -> List[dict]:
        params = {"select": "*", "order": "discovered_at.desc"}
        if prompt_name:
            params["prompt_name"] = f"eq.{prompt_name}"
        if discovered_by:
            params["discovered_by"] = f"eq.{discovered_by}"
        return self._request("GET", "tracks", params=params)

    def get_tracks_by_playlist(self, playlist_id: str) -> List[dict]:
        return self._request("GET", "tracks", params={
            "select": "*",
            "playlist_id": f"eq.{playlist_id}",
            "order": "discovered_at.desc"
        })

    def link_tracks_to_playlist(self, track_ids: List[str], playlist_id: str) -> dict:
        if not track_ids:
            return {}
        ids = ",".join(track_ids)
        return self._request("PATCH", f"tracks?id=in.({ids})", {
            "playlist_id": playlist_id
        })

    # --- RATINGS ---

    def submit_rating(self, playlist_id: str, rated_by: str, rating: int,
                      feedback: str = "", tracks_kept: int = 0, tracks_removed: int = 0) -> dict:
        return self._request("POST", "ratings", {
            "playlist_id": playlist_id,
            "rated_by": rated_by,
            "rating": rating,
            "feedback": feedback,
            "tracks_kept": tracks_kept,
            "tracks_removed": tracks_removed,
            "created_at": datetime.now().isoformat()
        })

    def get_ratings(self, playlist_id: Optional[str] = None) -> List[dict]:
        params = {"select": "*", "order": "created_at.desc"}
        if playlist_id:
            params["playlist_id"] = f"eq.{playlist_id}"
        return self._request("GET", "ratings", params=params)

    def get_average_rating(self, playlist_id: str) -> Optional[float]:
        ratings = self.get_ratings(playlist_id)
        if not ratings:
            return None
        values = [r.get("rating") or 0 for r in ratings]
        return sum(values) / len(values)

    def get_user_rating(self, playlist_id: str, user: str) -> Optional[dict]:
        results = self._request("GET", "ratings", params={
            "select": "*",
            "playlist_id": f"eq.{playlist_id}",
            "rated_by": f"eq.{user}",
            "limit": 1
        })
        return results[0] if results else None

    # --- PROMPTS ---

    def create_prompt(self, name: str, label: str, genre: str, energy: str,
                      bpm_min: int, bpm_max: int, timeframe: str,
                      exclude_playlist: str, limit: int, description: str,
                      created_by: str, release_date_range: str = "last_3_months") -> dict:
        return self._request("POST", "prompts", {
            "name": name,
            "label": label,
            "genre": genre,
            "energy": energy,
            "bpm_min": bpm_min,
            "bpm_max": bpm_max,
            "timeframe": timeframe,
            "exclude_playlist": exclude_playlist,
            "release_date_range": release_date_range or "last_3_months",
            "limit": limit,
            "description": description,
            "created_by": created_by,
            "created_at": datetime.now().isoformat()
        })

    def get_prompts(self, created_by: Optional[str] = None) -> List[dict]:
        params = {"select": "*", "order": "created_at.desc"}
        if created_by:
            params["created_by"] = f"eq.{created_by}"
        return self._request("GET", "prompts", params=params)

    def get_prompt_by_name(self, name: str) -> Optional[dict]:
        results = self._request("GET", "prompts", params={
            "select": "*",
            "name": f"eq.{name}",
            "limit": 1
        })
        return results[0] if results else None

    # --- FEED ITEMS ---

    def create_feed_item(self, source: str, title: str, artist: str, url: str,
                         genre: Optional[str], label: Optional[str],
                         published_at: str) -> dict:
        return self._request("POST", "feed_items", {
            "source": source,
            "title": title,
            "artist": artist,
            "url": url,
            "genre": genre,
            "label": label,
            "published_at": published_at,
            "processed": False,
            "created_at": datetime.now().isoformat()
        })

    def get_feed_items(self, source: Optional[str] = None, processed: Optional[bool] = None) -> List[dict]:
        params = {"select": "*", "order": "published_at.desc"}
        if source:
            params["source"] = f"eq.{source}"
        if processed is not None:
            params["processed"] = f"eq.{str(bool(processed)).lower()}"
        return self._request("GET", "feed_items", params=params)

    def mark_feed_processed(self, item_id: str) -> dict:
        return self._request("PATCH", f"feed_items?id=eq.{item_id}", {"processed": True})

    # --- AGENT RUNS ---

    def start_agent_run(self, agent: str, prompt_name: str) -> dict:
        return self._request("POST", "agent_runs", {
            "agent": agent or "",
            "prompt_name": prompt_name or "",
            "started_at": datetime.now().isoformat(),
            "status": "running"
        })

    def complete_agent_run(self, run_id: str, tracks_found: int, tracks_matched: int) -> dict:
        return self._request("PATCH", f"agent_runs?id=eq.{run_id}", {
            "tracks_found": tracks_found,
            "tracks_matched": tracks_matched,
            "completed_at": datetime.now().isoformat(),
            "status": "completed"
        })

    def fail_agent_run(self, run_id: str) -> dict:
        return self._request("PATCH", f"agent_runs?id=eq.{run_id}", {
            "completed_at": datetime.now().isoformat(),
            "status": "failed"
        })

    def get_agent_runs(self, agent: Optional[str] = None, limit: int = 20) -> List[dict]:
        params = {"select": "*", "order": "started_at.desc", "limit": limit}
        if agent:
            params["agent"] = f"eq.{agent}"
        return self._request("GET", "agent_runs", params=params)

    def get_agent_run_by_id(self, run_id: str) -> Optional[dict]:
        results = self._request("GET", "agent_runs", params={
            "select": "*",
            "id": f"eq.{run_id}",
            "limit": 1
        })
        return results[0] if results else None

    # --- HEALTH CHECK ---

    def health_check(self) -> bool:
        """Verify connection to Supabase."""
        try:
            runs = self.get_agent_runs(limit=1)
            print(f"[RunwayClient] ✅ Connected to {self.url}")
            return True
        except Exception as e:
            print(f"[RunwayClient] ❌ Connection failed: {e}")
            return False


# CLI quick test
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Test connection")
    args = parser.parse_args()

    if args.test:
        client = RunwayClient()
        client.health_check()
