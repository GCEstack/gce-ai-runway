#!/usr/bin/env python3
"""
Discovery Agent Module — importable by API routes or CLI.
Usage:
    from agents.discovery import DiscoveryAgent
    agent = DiscoveryAgent("KIMI", spotify_cmd, spotify_cwd, tidal_cmd, tidal_cwd)
    results = agent.discover(prompt_dict)
"""

import json
import subprocess
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class DiscoveryResult:
    track_id: str
    title: str
    artist: str
    album: str
    source: str
    url: str
    discovered_by: str
    discovered_at: str
    match_score: float
    prompt_name: str
    release_date: Optional[str] = None


class MCPClient:
    """Generic MCP stdio client."""

    def __init__(self, name: str, command: List[str], cwd: str):
        self.name = name
        self.command = command
        self.cwd = cwd
        self.process = None
        self.req_id = 0

    def start(self):
        self.process = subprocess.Popen(
            self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, cwd=self.cwd, bufsize=1
        )
        line = self.process.stdout.readline()
        return line

    def stop(self):
        if self.process:
            self.process.terminate()
            try: self.process.wait(timeout=5)
            except: self.process.kill()
            self.process = None

    def call(self, tool: str, args: dict) -> dict:
        self.req_id += 1
        req = json.dumps({
            "jsonrpc": "2.0", "id": self.req_id,
            "method": "tools/call",
            "params": {"name": tool, "arguments": args}
        }) + "\n"
        self.process.stdin.write(req)
        self.process.stdin.flush()
        resp = self.process.stdout.readline()
        return json.loads(resp).get("result", {})

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *a):
        self.stop()
        return False


class DiscoveryAgent:
    """Discovers tracks across Spotify and Tidal."""

    def __init__(self, agent_name: str, spotify_cmd: List[str], spotify_cwd: str,
                 tidal_cmd: List[str], tidal_cwd: str):
        self.agent_name = agent_name.upper()
        self.spotify_cmd = spotify_cmd
        self.spotify_cwd = spotify_cwd
        self.tidal_cmd = tidal_cmd
        self.tidal_cwd = tidal_cwd

    def discover(self, prompt: dict) -> List[DiscoveryResult]:
        """Run discovery against both services."""
        results = []
        query = self._build_query(prompt)
        limit = prompt.get("limit") or 50

        with MCPClient("Spotify", self.spotify_cmd, self.spotify_cwd) as sp, \
             MCPClient("Tidal", self.tidal_cmd, self.tidal_cwd) as td:

            # Spotify
            try:
                sp_res = sp.call("spotify_search", {
                    "query": query, "type": "track", "limit": limit
                })
                items = sp_res.get("tracks", {}).get("items", []) if isinstance(sp_res.get("tracks"), dict) else sp_res.get("tracks", [])
                for item in items:
                    artist_name = "Unknown"
                    artists = item.get("artists") or []
                    if artists and artists[0]:
                        artist_name = artists[0].get("name") or "Unknown"
                    album = item.get("album") or {}
                    results.append(DiscoveryResult(
                        track_id=item.get("id") or "",
                        title=item.get("name") or "Unknown",
                        artist=artist_name,
                        album=album.get("name") or "Unknown",
                        source="spotify",
                        url=(item.get("external_urls") or {}).get("spotify") or "",
                        discovered_by=self.agent_name,
                        discovered_at=datetime.now().isoformat(),
                        match_score=0.0,
                        prompt_name=prompt.get("name") or "unnamed",
                        release_date=self._normalize_release_date(album.get("release_date"))
                    ))
            except Exception as e:
                print(f"[Discovery] Spotify error: {e}")

            # Tidal
            try:
                td_res = td.call("tidal_search", {
                    "query": query, "type": "track", "limit": limit
                })
                td_tracks = td_res.get("tracks", [])
                if isinstance(td_tracks, dict):
                    items = td_tracks.get("items", [])
                elif isinstance(td_tracks, list):
                    items = td_tracks
                else:
                    items = td_res.get("items", [])
                for item in items:
                    artists = item.get("artists") or []
                    artist_name = artists[0].get("name") or "Unknown" if artists and artists[0] else "Unknown"
                    results.append(DiscoveryResult(
                        track_id=item.get("id") or "",
                        title=item.get("title") or "Unknown",
                        artist=artist_name,
                        album=item.get("album") or "Unknown",
                        source="tidal",
                        url=f"https://tidal.com/browse/track/{item.get('id') or ''}",
                        discovered_by=self.agent_name,
                        discovered_at=datetime.now().isoformat(),
                        match_score=0.0,
                        prompt_name=prompt.get("name") or "unnamed",
                        release_date=self._normalize_release_date(item.get("releaseDate"))
                    ))
            except Exception as e:
                print(f"[Discovery] Tidal error: {e}")

        # Filter by release date and deduplicate
        filtered = self._filter_by_release_date(results, prompt.get("release_date_range"))
        seen = set()
        unique = []
        for r in filtered:
            key = f"{(r.title or '').lower()}|{(r.artist or '').lower()}"
            if key not in seen:
                seen.add(key)
                unique.append(r)

        return unique[:limit]

    def _build_query(self, prompt: dict) -> str:
        parts = []
        if prompt.get("label"):
            parts.append(f'label:"{prompt["label"]}"')
        if prompt.get("genre"):
            parts.append(prompt["genre"])
        if prompt.get("energy"):
            parts.append(prompt["energy"])
        bpm_min = prompt.get("bpm_min")
        bpm_max = prompt.get("bpm_max")
        if bpm_min and bpm_max:
            parts.append(f"{bpm_min}-{bpm_max} bpm")
        return " ".join(parts) if parts else (prompt.get("raw_query") or "")

    @staticmethod
    def _normalize_release_date(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        value = value.strip()
        if len(value) == 4 and value.isdigit():
            return f"{value}-01-01"
        if len(value) == 7 and value[4] == '-':
            return f"{value}-01"
        if len(value) >= 10:
            return value[:10]
        return None

    @staticmethod
    def _release_cutoff(range_value: Optional[str]) -> Optional[str]:
        range_value = (range_value or "last_3_months").lower().strip()
        now = datetime.now()
        if range_value == "last_3_months":
            delta = timedelta(days=90)
        elif range_value == "last_6_months":
            delta = timedelta(days=180)
        elif range_value == "last_year":
            delta = timedelta(days=365)
        elif range_value == "all":
            return None
        else:
            delta = timedelta(days=90)
        return (now - delta).date().isoformat()

    def _filter_by_release_date(self, results: List[DiscoveryResult], range_value: Optional[str]) -> List[DiscoveryResult]:
        cutoff = self._release_cutoff(range_value)
        if not cutoff:
            return results
        kept = []
        for r in results:
            if r.release_date and r.release_date >= cutoff:
                kept.append(r)
        print(f"[Discovery] Release-date filter ({range_value} >= {cutoff}): {len(kept)}/{len(results)} kept")
        return kept

    def to_dict(self, results: List[DiscoveryResult]) -> List[dict]:
        return [asdict(r) for r in results]


# CLI entry point
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", required=True, choices=["kimi", "claude"])
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--spotify-cmd", default='["node", "build/index.js"]')
    parser.add_argument("--spotify-cwd", default=".")
    parser.add_argument("--tidal-cmd", default='["node", "build/index.js"]')
    parser.add_argument("--tidal-cwd", default=".")
    args = parser.parse_args()

    with open(args.prompt) as f:
        prompt = json.load(f)

    agent = DiscoveryAgent(
        args.agent, json.loads(args.spotify_cmd), args.spotify_cwd,
        json.loads(args.tidal_cmd), args.tidal_cwd
    )
    results = agent.discover(prompt)
    print(json.dumps(agent.to_dict(results), indent=2))
