#!/usr/bin/env python3
"""
Discovery Agent — Production
Discovers tracks and writes results to Supabase.
Includes playlist similarity check before running discovery.
Run from runway root: python agents/discovery_production.py --agent kimi --prompt friday_warmup
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Optional, Any

# Add parent dir to path so we can import runway_client
sys.path.insert(0, str(Path(__file__).parent.parent))

from runway_client import RunwayClient
from agents.discovery import DiscoveryAgent


class PlaylistSimilarityChecker:
    """
    Compare a new prompt's intent against existing playlists in Supabase.
    Uses fuzzy matching on names, descriptions, and structured fields.
    """

    def __init__(self, client: RunwayClient):
        self.client = client

    def check(self, prompt: dict) -> Dict[str, Any]:
        """
        Return similarity decision:
          - action: 'skip' | 'ask' | 'create'
          - score: 0.0 - 1.0
          - matched_playlist: dict | None
          - message: human-readable recommendation
        """
        existing = self.client.get_playlists()
        if not existing:
            return {"action": "create", "score": 0.0, "matched_playlist": None, "message": ""}

        exclude_name = (prompt.get("exclude_playlist", "") or "").strip().lower()
        best_score = 0.0
        best_match = None

        for playlist in existing:
            # Respect explicit exclusion from the prompt.
            if exclude_name and exclude_name in (playlist.get("name", "") or "").lower():
                continue
            score = self._score_similarity(prompt, playlist)
            if score > best_score:
                best_score = score
                best_match = playlist

        if best_score >= 0.80:
            return {
                "action": "skip",
                "score": best_score,
                "matched_playlist": best_match,
                "message": (
                    f"Playlist '{best_match.get('name') or 'Untitled'}' already covers this. "
                    "Add tracks there instead?"
                ),
            }
        elif best_score >= 0.50:
            return {
                "action": "ask",
                "score": best_score,
                "matched_playlist": best_match,
                "message": (
                    f"Similar to '{best_match.get('name') or 'Untitled'}' — create anyway or merge?"
                ),
            }
        else:
            return {
                "action": "create",
                "score": best_score,
                "matched_playlist": best_match,
                "message": "",
            }

    def _score_similarity(self, prompt: dict, playlist: dict) -> float:
        """Compute weighted similarity between prompt and existing playlist.

        Only compares against columns that exist in the current schema:
        name, prompt_name, tags, comments, energy, rating. Prompts may also
        supply genre, bpm_min, bpm_max and description for richer matching.
        """
        weights = []
        scores = []

        # Name fuzzy match vs prompt name
        prompt_name = prompt.get("name") or ""
        playlist_name = playlist.get("name") or ""
        if prompt_name and playlist_name:
            weights.append(0.25)
            scores.append(self._token_jaccard(prompt_name, playlist_name))

        # Prompt name vs playlist prompt_name
        playlist_prompt_name = playlist.get("prompt_name") or ""
        if prompt_name and playlist_prompt_name:
            weights.append(0.20)
            scores.append(self._token_jaccard(prompt_name, playlist_prompt_name))

        # Description / intent keywords vs playlist metadata text
        prompt_desc = prompt.get("description") or ""
        playlist_meta_text = " ".join([
            playlist.get("comments") or "",
            playlist.get("tags") or "",
            playlist.get("name") or "",
        ]).strip()
        combined_text = f"{prompt_name} {prompt_desc}" if (prompt_name or prompt_desc) else ""
        if combined_text and playlist_meta_text:
            weights.append(0.20)
            scores.append(self._token_jaccard(combined_text, playlist_meta_text))

        # Genre match (prompt genre vs playlist tags/comments/name)
        prompt_genre = prompt.get("genre") or ""
        if prompt_genre and playlist_meta_text:
            weights.append(0.15)
            scores.append(self._exact_or_contained(prompt_genre, playlist_meta_text))

        # Energy match
        prompt_energy = prompt.get("energy") or ""
        playlist_energy = playlist.get("energy") or ""
        if prompt_energy and playlist_energy:
            weights.append(0.10)
            scores.append(self._exact_or_contained(prompt_energy, playlist_energy))

        # BPM range overlap (playlists don't store BPM yet, but keep for future fields)
        bpm_score = self._bpm_overlap_score(
            prompt.get("bpm_min"), prompt.get("bpm_max"),
            playlist.get("bpm_min"), playlist.get("bpm_max")
        )
        if bpm_score is not None:
            weights.append(0.10)
            scores.append(bpm_score)

        if not weights:
            return 0.0

        total = sum(w * s for w, s in zip(weights, scores))
        return round(min(total / sum(weights), 1.0), 3)

    @staticmethod
    def _normalize(text: str) -> str:
        text = text or ""
        text = re.sub(r"[^\w\s]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip().lower()

    @staticmethod
    def _token_jaccard(a: str, b: str) -> float:
        tokens_a = set(PlaylistSimilarityChecker._normalize(a).split())
        tokens_b = set(PlaylistSimilarityChecker._normalize(b).split())
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        # Boost exact substring matches
        norm_a = PlaylistSimilarityChecker._normalize(a)
        norm_b = PlaylistSimilarityChecker._normalize(b)
        if norm_a in norm_b or norm_b in norm_a:
            return max(len(intersection) / len(union), 0.85)
        return len(intersection) / len(union)

    @staticmethod
    def _exact_or_contained(a: str, b: str) -> float:
        norm_a = PlaylistSimilarityChecker._normalize(a)
        norm_b = PlaylistSimilarityChecker._normalize(b)
        if not norm_a or not norm_b:
            return 0.0
        if norm_a == norm_b:
            return 1.0
        if norm_a in norm_b or norm_b in norm_a:
            return 0.75
        # Partial token overlap
        tokens_a = set(norm_a.split())
        tokens_b = set(norm_b.split())
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        return len(intersection) / len(union) if union else 0.0

    @staticmethod
    def _bpm_overlap_score(a_min, a_max, b_min, b_max) -> Optional[float]:
        try:
            a_min = int(a_min) if a_min is not None else None
            a_max = int(a_max) if a_max is not None else None
            b_min = int(b_min) if b_min is not None else None
            b_max = int(b_max) if b_max is not None else None
        except (ValueError, TypeError):
            return None

        if a_min is None or a_max is None or b_min is None or b_max is None:
            return None

        overlap_start = max(a_min, b_min)
        overlap_end = min(a_max, b_max)
        if overlap_end < overlap_start:
            # No overlap — compute distance
            distance = min(abs(a_max - b_min), abs(b_max - a_min))
            if distance <= 5:
                return 0.5
            elif distance <= 10:
                return 0.25
            return 0.0

        overlap_len = overlap_end - overlap_start
        a_len = a_max - a_min
        b_len = b_max - b_min
        if a_len <= 0 or b_len <= 0:
            return None

        overlap_ratio = overlap_len / max(a_len, b_len)
        if overlap_ratio >= 0.8:
            return 1.0
        elif overlap_ratio >= 0.5:
            return 0.75
        return overlap_ratio


def run_discovery(agent_name: str, prompt_name: str, run_id: str | None,
                  spotify_cwd: str, tidal_cwd: str,
                  spotify_cmd: list = None, tidal_cmd: list = None,
                  force_create: bool = False) -> dict:
    """Run discovery and save to Supabase."""

    client = RunwayClient()

    # Get prompt from Supabase
    prompt = client.get_prompt_by_name(prompt_name)
    if not prompt:
        print(f"[Discovery] ERROR: Prompt '{prompt_name}' not found in Supabase")
        return {"error": "prompt not found"}

    # Playlist similarity check
    checker = PlaylistSimilarityChecker(client)
    similarity = checker.check(prompt)

    if similarity["action"] == "skip":
        print(f"[Discovery] SKIP: {similarity['message']}")
        return {
            "action": "skip",
            "similarity_score": similarity["score"],
            "matched_playlist": similarity["matched_playlist"],
            "message": similarity["message"],
        }

    if similarity["action"] == "ask":
        print(f"[Discovery] ASK: {similarity['message']}")
        return {
            "action": "ask",
            "similarity_score": similarity["score"],
            "matched_playlist": similarity["matched_playlist"],
            "message": similarity["message"],
        }

    # Proceed with discovery
    # Reuse an existing run if run_id is provided, otherwise start a new one
    if run_id:
        existing = client.get_agent_run_by_id(run_id)
        if not existing:
            print(f"[Discovery] ERROR: Run '{run_id}' not found")
            return {"error": "run not found"}
    else:
        run = client.start_agent_run(agent_name, prompt_name)
        run_id = run[0].get("id") if isinstance(run, list) and run else run.get("id") if isinstance(run, dict) else None

    try:
        # Run discovery
        sp_cmd = spotify_cmd or ["node", "build/index.js"]
        td_cmd = tidal_cmd or ["node", "build/index.js"]

        agent = DiscoveryAgent(agent_name, sp_cmd, spotify_cwd, td_cmd, tidal_cwd)
        results = agent.discover(prompt)

        # Save tracks to Supabase
        for track in results:
            client.create_track(
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
            client.complete_agent_run(run_id, len(results), len(results))

        print(f"[Discovery] OK: Found {len(results)} tracks for '{prompt_name}'")
        return {
            "action": "create",
            "run_id": run_id,
            "tracks_found": len(results),
            "tracks": agent.to_dict(results),
            "similarity_score": similarity["score"],
            "matched_playlist": similarity["matched_playlist"],
        }

    except Exception as e:
        if run_id:
            client.fail_agent_run(run_id)
        print(f"[Discovery] ERROR: Failed: {e}")
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", required=True, choices=["kimi", "claude"])
    parser.add_argument("--prompt", required=True, help="Prompt name from Supabase")
    parser.add_argument("--run-id", default=None, help="Existing agent_run id to update (optional)")
    parser.add_argument(
        "--spotify-cwd",
        default=os.getenv("SPOTIFY_MCP_CWD", "C:\\Users\\Dekan AI Brother\\spotify-mcp-server"),
    )
    parser.add_argument(
        "--tidal-cwd",
        default=os.getenv("TIDAL_MCP_CWD", "C:\\Users\\Dekan AI Brother\\tidal-mcp-server"),
    )
    parser.add_argument("--spotify-cmd", default='["node", "build/index.js"]')
    parser.add_argument("--tidal-cmd", default='["node", "build/index.js"]')
    parser.add_argument("--force-create", action="store_true", help="Skip similarity check and create anyway")
    args = parser.parse_args()

    result = run_discovery(
        args.agent.upper(),
        args.prompt,
        args.run_id,
        args.spotify_cwd,
        args.tidal_cwd,
        json.loads(args.spotify_cmd),
        json.loads(args.tidal_cmd),
        args.force_create
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
