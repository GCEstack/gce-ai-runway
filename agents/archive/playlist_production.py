#!/usr/bin/env python3
"""
Playlist Agent — Production
Creates playlists and saves to Supabase.
Run from runway root: python agents/playlist_production.py --agent kimi --service spotify --name "Friday Warmup" --prompt friday_warmup
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from runway_client import RunwayClient
from agents.playlist import PlaylistAgent


def run_playlist(agent_name: str, service: str, name: str, description: str,
                 prompt_name: str, spotify_cwd: str, tidal_cwd: str,
                 cmd: list = None, is_public: bool = False) -> dict:
    """Create playlist and save to Supabase."""

    client = RunwayClient()

    # Get tracks from Supabase (discovered by this agent for this prompt)
    tracks = client.get_tracks(prompt_name=prompt_name, discovered_by=agent_name)
    if not tracks:
        print(f"[Playlist] ⚠️ No tracks found for prompt '{prompt_name}' by {agent_name}")
        return {"error": "no tracks found"}

    # Determine service and paths
    if service == "spotify":
        cwd = spotify_cwd
        cmd = cmd or ["node", "build/index.js"]
    elif service == "tidal":
        cwd = tidal_cwd
        cmd = cmd or ["node", "build/index.js"]
    else:
        return {"error": f"unknown service: {service}"}

    # Create playlist
    agent = PlaylistAgent(agent_name, service, cmd, cwd)
    result = agent.create(name, description, tracks, is_public)

    # Save to Supabase
    playlist = client.create_playlist(
        name=result.get("name") or name,
        agent=agent_name,
        service=service,
        external_id=result.get("playlist_id") or "",
        track_count=result.get("track_count") or 0,
        prompt_name=prompt_name or ""
    )

    # Link tracks to the playlist so they show up in the dashboard
    playlist_record = playlist[0] if isinstance(playlist, list) and playlist else playlist if isinstance(playlist, dict) else {}
    playlist_db_id = playlist_record.get("id")
    if playlist_db_id:
        track_ids = [str(t.get("id")) for t in tracks if t.get("id")]
        if track_ids:
            client.link_tracks_to_playlist(track_ids, playlist_db_id)
            print(f"[Playlist] 🔗 Linked {len(track_ids)} tracks to playlist {playlist_db_id}")

    print(f"[Playlist] ✅ Created {result['name']} ({result['track_count']} tracks)")
    return {**result, "playlist_db_id": playlist_db_id}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", required=True)
    parser.add_argument("--service", required=True, choices=["spotify", "tidal"])
    parser.add_argument("--name", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--prompt", required=True, help="Prompt name to pull tracks from")
    parser.add_argument(
        "--spotify-cwd",
        default=os.getenv("SPOTIFY_MCP_CWD", "C:\\Users\\Dekan AI Brother\\spotify-mcp-server"),
    )
    parser.add_argument(
        "--tidal-cwd",
        default=os.getenv("TIDAL_MCP_CWD", "C:\\Users\\Dekan AI Brother\\tidal-mcp-server"),
    )
    parser.add_argument("--cmd", default='["node", "build/index.js"]')
    parser.add_argument("--public", action="store_true")
    args = parser.parse_args()

    result = run_playlist(
        args.agent.upper(),
        args.service,
        args.name,
        args.description,
        args.prompt,
        args.spotify_cwd,
        args.tidal_cwd,
        json.loads(args.cmd) if args.cmd else None,
        args.public
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
