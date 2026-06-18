#!/usr/bin/env python3
"""
Discovery Agent v2 â€” Service-specific query mapping + playlist similarity check.
Maps prompt attributes correctly to Spotify vs Tidal search syntax.
Checks existing playlists before creating duplicates.
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from runway_client import RunwayClient
from agents.discovery import DiscoveryAgent as BaseDiscoveryAgent


@dataclass
class PromptAttributes:
    """Normalized prompt attributes."""
    name: str
    label: Optional[str]
    genre: Optional[str]
    energy: Optional[str]
    bpm_min: int
    bpm_max: int
    timeframe: str
    release_date_range: str
    exclude_playlist: Optional[str]
    limit: int
    description: str


@dataclass
class ExistingPlaylist:
    """Existing playlist from Supabase."""
    name: str
    agent: str
    service: str
    track_count: int
    prompt_name: str
    created_at: str


class SmartDiscoveryAgent:
    """Discovers tracks with service-aware query mapping."""

    def __init__(self, agent_name: str, spotify_cwd: str, tidal_cwd: str,
                 spotify_cmd: list = None, tidal_cmd: list = None):
        self.agent_name = agent_name.upper()
        self.spotify_cwd = spotify_cwd
        self.tidal_cwd = tidal_cwd
        self.spotify_cmd = spotify_cmd or ["node", "build/index.js"]
        self.tidal_cmd = tidal_cmd or ["node", "build/index.js"]
        self.client = RunwayClient()

    def build_spotify_query(self, attrs: PromptAttributes) -> str:
        """Build Spotify advanced search query."""
        parts = []
        if attrs.label:
            parts.append(f'label:"{attrs.label}"')
        if attrs.genre:
            parts.append(f'genre:{attrs.genre}')
        if attrs.energy:
            parts.append(attrs.energy)
        if attrs.bpm_min > 0 and attrs.bpm_max > 0:
            parts.append(f'{attrs.bpm_min}-{attrs.bpm_max} bpm')
        return " ".join(parts) if parts else attrs.description

    def build_tidal_query(self, attrs: PromptAttributes) -> str:
        """Build Tidal simple keyword query."""
        parts = []
        if attrs.label:
            parts.append(attrs.label)  # No quotes, no label: prefix
        if attrs.genre:
            parts.append(attrs.genre)
        if attrs.energy:
            parts.append(attrs.energy)
        # Tidal doesn't support BPM filtering in search, skip it
        return " ".join(parts) if parts else attrs.description

    def find_similar_playlists(self, attrs: PromptAttributes) -> List[ExistingPlaylist]:
        """Find existing playlists with similar attributes."""
        all_playlists = self.client.get_playlists()
        similar = []

        for pl in all_playlists:
            score = 0
            # Name similarity
            pl_name = (pl.get("name") or "").lower()
            pl_prompt_name = (pl.get("prompt_name") or "").lower()

            if attrs.name.lower() in pl_name:
                score += 50
            # Genre match in description
            if attrs.genre and attrs.genre.lower() in pl_prompt_name:
                score += 20
            # Same agent
            if pl.get("agent") == self.agent_name:
                score += 10

            if score >= 50:
                similar.append(ExistingPlaylist(
                    name=pl.get("name") or "",
                    agent=pl.get("agent") or "",
                    service=pl.get("service") or "",
                    track_count=pl.get("track_count") or 0,
                    prompt_name=pl.get("prompt_name") or "",
                    created_at=pl.get("created_at") or ""
                ))

        return similar

    def check_similarity(self, attrs: PromptAttributes) -> Dict[str, Any]:
        """Check if similar playlist exists and return action recommendation."""
        similar = self.find_similar_playlists(attrs)

        if not similar:
            return {"action": "create", "reason": "No similar playlists found", "matches": []}

        # Find best match
        best = similar[0]

        # Calculate similarity score
        score = 0
        if attrs.name.lower() in (best.name or "").lower():
            score += 40
        if attrs.genre and attrs.genre.lower() in (best.prompt_name or "").lower():
            score += 30
        if best.agent == self.agent_name:
            score += 20
        if best.service in ["spotify", "tidal"]:
            score += 10

        if score >= 80:
            return {
                "action": "skip",
                "reason": f"Playlist '{best.name}' already covers this",
                "matches": [asdict(pl) for pl in similar],
                "score": score
            }
        elif score >= 50:
            return {
                "action": "ask",
                "reason": f"Similar to '{best.name}' â€” create anyway or merge?",
                "matches": [asdict(pl) for pl in similar],
                "score": score
            }
        else:
            return {"action": "create", "reason": "Different enough", "matches": [asdict(pl) for pl in similar], "score": score}

    def discover(self, prompt_name: str, service: str = "both") -> Dict[str, Any]:
        """Run discovery with smart query mapping and similarity check."""

        # Get prompt from Supabase
        prompt = self.client.get_prompt_by_name(prompt_name)
        if not prompt:
            return {"error": f"Prompt '{prompt_name}' not found"}

        attrs = PromptAttributes(
            name=prompt.get("name") or "",
            label=prompt.get("label") or None,
            genre=prompt.get("genre") or None,
            energy=prompt.get("energy") or None,
            bpm_min=prompt.get("bpm_min") or 0,
            bpm_max=prompt.get("bpm_max") or 0,
            timeframe=prompt.get("timeframe") or "",
            release_date_range=prompt.get("release_date_range") or "last_3_months",
            exclude_playlist=prompt.get("exclude_playlist") or None,
            limit=prompt.get("limit") or 50,
            description=prompt.get("description") or ""
        )

        # Check similarity
        similarity = self.check_similarity(attrs)

        # If skip recommended, return early
        if similarity["action"] == "skip":
            return {
                "prompt": prompt_name,
                "action": "skip",
                "reason": similarity["reason"],
                "matches": similarity["matches"],
                "score": similarity["score"]
            }

        # Build service-specific queries
        spotify_query = self.build_spotify_query(attrs)
        tidal_query = self.build_tidal_query(attrs)

        print(f"[SmartDiscovery] Spotify query: {spotify_query}")
        print(f"[SmartDiscovery] Tidal query: {tidal_query}")

        # Start agent run
        run = self.client.start_agent_run(self.agent_name, prompt_name)
        run_id = run[0].get("id") if isinstance(run, list) and run else run.get("id") if isinstance(run, dict) else None

        results = []

        try:
            # Run discovery based on service
            if service in ["spotify", "both"]:
                sp_results = self._discover_spotify(spotify_query, attrs.limit)
                results.extend(sp_results)

            if service in ["tidal", "both"]:
                td_results = self._discover_tidal(tidal_query, attrs.limit)
                results.extend(td_results)

            # Deduplicate
            seen = set()
            unique = []
            for r in results:
                key = f"{(r.title or '').lower()}|{(r.artist or '').lower()}"
                if key not in seen:
                    seen.add(key)
                    unique.append(r)

            results = unique[:attrs.limit]

            # Save tracks to Supabase
            for track in results:
                self.client.create_track(
                    title=track.title,
                    artist=track.artist,
                    album=track.album,
                    source=track.source,
                    isrc=track.isrc,
                    discovered_by=track.discovered_by,
                    prompt_name=prompt_name,
                    release_date=track.release_date
                )

            # Complete run
            if run_id:
                self.client.complete_agent_run(run_id, len(results), len(results))

            return {
                "prompt": prompt_name,
                "action": "created",
                "tracks_found": len(results),
                "similarity_check": similarity,
                "spotify_query": spotify_query,
                "tidal_query": tidal_query,
                "tracks": [asdict(r) for r in results]
            }

        except Exception as e:
            if run_id:
                self.client.fail_agent_run(run_id)
            return {"error": str(e)}

    def _discover_spotify(self, query: str, limit: int):
        """Discover on Spotify."""
        from agents.discovery import DiscoveryAgent
        agent = DiscoveryAgent(self.agent_name, self.spotify_cmd, self.spotify_cwd, self.tidal_cmd, self.tidal_cwd)
        # Use base agent's Spotify search
        # ... implementation
        return []

    def _discover_tidal(self, query: str, limit: int):
        """Discover on Tidal."""
        from agents.discovery import DiscoveryAgent
        agent = DiscoveryAgent(self.agent_name, self.spotify_cmd, self.spotify_cwd, self.tidal_cmd, self.tidal_cwd)
        # Use base agent's Tidal search
        # ... implementation
        return []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", required=True, choices=["kimi", "claude"])
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--service", default="both", choices=["spotify", "tidal", "both"])
    parser.add_argument("--spotify-cwd", default="C:\\Users\\Dekan AI Brother\\spotify-mcp-server")
    parser.add_argument("--tidal-cwd", default="C:\\Users\\Dekan AI Brother\\tidal-mcp-server")
    args = parser.parse_args()

    agent = SmartDiscoveryAgent(
        args.agent,
        args.spotify_cwd,
        args.tidal_cwd
    )

    result = agent.discover(args.prompt, args.service)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

