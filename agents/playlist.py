#!/usr/bin/env python3
"""
Playlist Agent Module — creates playlists with KIMI_/CLAUDE_ prefix.
Importable by API routes or CLI.
"""

import json
import subprocess
from typing import List, Dict


class MCPClient:
    def __init__(self, name: str, command: list, cwd: str):
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
        self.process.stdout.readline()

    def stop(self):
        if self.process:
            self.process.terminate()
            try: self.process.wait(timeout=5)
            except: self.process.kill()

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

    def __enter__(self): self.start(); return self
    def __exit__(self, *a): self.stop(); return False


class PlaylistAgent:
    def __init__(self, agent_name: str, service: str, cmd: list, cwd: str):
        self.agent_name = agent_name.upper()
        self.service = service.lower()
        self.cmd = cmd
        self.cwd = cwd

    def create(self, name: str, description: str, tracks: List[Dict], 
               is_public: bool = False) -> Dict[str, str]:
        prefixed_name = f"{self.agent_name}_{name}"

        with MCPClient(self.service, self.cmd, self.cwd) as client:
            if self.service == "spotify":
                result = client.call("spotify_create_playlist", {
                    "name": prefixed_name,
                    "description": f"{description} | Created by {self.agent_name}",
                    "public": is_public
                })
                playlist_id = result.get("id")

                uris = [f"spotify:track:{t.get('track_id')}" for t in tracks if t.get("source") == "spotify" and t.get("track_id")]
                if uris:
                    for i in range(0, len(uris), 100):
                        client.call("spotify_add_tracks", {
                            "playlist_id": playlist_id,
                            "track_uris": uris[i:i+100]
                        })

            elif self.service == "tidal":
                result = client.call("tidal_create_playlist", {
                    "name": prefixed_name,
                    "description": f"{description} | Created by {self.agent_name}",
                    "public": is_public
                })
                playlist_id = result.get("id") or result.get("playlist_id")

                ids = [t.get("track_id") for t in tracks if t.get("source") == "tidal" and t.get("track_id")]
                if ids:
                    for i in range(0, len(ids), 100):
                        client.call("tidal_add_tracks", {
                            "playlist_id": playlist_id,
                            "track_ids": ids[i:i+100]
                        })

        return {
            "playlist_id": playlist_id,
            "name": prefixed_name,
            "service": self.service,
            "track_count": len(tracks),
            "agent": self.agent_name
        }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", required=True)
    parser.add_argument("--service", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--tracks", required=True)
    parser.add_argument("--cmd", default='["node", "build/index.js"]')
    parser.add_argument("--cwd", default=".")
    parser.add_argument("--public", action="store_true")
    args = parser.parse_args()

    with open(args.tracks) as f:
        tracks = json.load(f)

    agent = PlaylistAgent(args.agent, args.service, json.loads(args.cmd), args.cwd)
    result = agent.create(args.name, args.description, tracks, args.public)
    print(json.dumps(result, indent=2))
