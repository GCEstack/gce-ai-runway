# Runway — MCP Migration Plan (Tidal & Spotify → Kimi)

**Project:** Runway Music Discovery Dashboard  
**Goal:** Replace the current Claude-centric local MCP subprocess model with a Kimi-native Model Context Protocol (MCP) integration for Tidal and Spotify.

---

## 1. Current State

### Tidal integration today

- Dashboard OAuth PKCE flow: `/api/tidal/auth` → `/api/tidal/callback`
- Tokens stored in Supabase `user_tokens` table
- REST wrappers in `lib/music.ts`: `searchTidal`, `getTidalPlaylistTracks`, `createTidalPlaylist`, etc.
- Used by: `/api/discover`, `/api/run-prompt`, `/api/recommend-similar`

### Spotify integration today

- No dashboard OAuth flow
- Local script `scripts/sync-playlists.mjs` reads `~/.spotify-mcp-tokens.json`
- Agents spawn `spotify-mcp-server` via subprocess (`agents/discovery.py`, `agents/playlist.py`)
- Used by: local agent scripts only

### Agent runner today

- `scripts/agent-runner.mjs` polls `agent_runs` every 5 seconds
- Spawns `agents/discovery_production.py` locally
- Hardcoded Windows paths to MCP servers (`C:\Users\Dekan AI Brother\Projects\01_ACTIVE\mcp-servers\spotify-mcp`)

---

## 2. Target Architecture

```
┌─────────────────────────────────────┐
│            Runway UI                │
│  (Next.js App Router, server/client)│
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│     Runway API (Next.js routes)     │
│  /api/run-prompt                    │
│  /api/recommend-similar             │
│  /api/discover                      │
│  /api/playlists/sync                │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│      Kimi MCP Client (Python/TS)    │
│  - Tidal MCP server                 │
│  - Spotify MCP server               │
│  - Unified Music Agent              │
└─────────────┬───────────────────────┘
              │
    ┌─────────┴──────────┐
    ▼                    ▼
┌─────────┐        ┌──────────┐
│  Tidal  │        │ Spotify  │
└─────────┘        └──────────┘
```

---

## 3. Tidal MCP

### OAuth flow

1. User clicks “Connect Tidal” in Runway Settings.
2. Runway redirects to Tidal authorize with PKCE.
3. Tidal callback exchanges code for tokens.
4. Tokens encrypted and stored in Supabase `user_tokens`.
5. Kimi MCP client reads tokens at runtime to call Tidal tools.

### MCP server capabilities

| Tool | Description |
|------|-------------|
| `tidal_search` | Search tracks, albums, artists |
| `tidal_get_playlists` | List user playlists |
| `tidal_create_playlist` | Create a new playlist |
| `tidal_add_tracks` | Add tracks to a playlist |
| `tidal_get_playback` | Get current playback state |
| `tidal_get_recommendations` | Get recommendations for a track/artist |

### Kimi prompt templates

```text
Discover peak-time techno tracks matching the prompt "[prompt_name]" with
BPM between [bpm_min] and [bpm_max]. Prefer recent releases on labels like
"[label]". Return a list of 20 tracks with title, artist, album, and Tidal ID.
```

```text
Create a Tidal playlist named "KIMI_[genre]_[energy]" for Dekan's taste profile.
Include underground tracks released in the last 3 months. Avoid artists already
in playlist [exclude_playlist_id].
```

```text
What's trending on Beatport/1001Tracklists this week? Cross-reference those
titles with Tidal and return available tracks with IDs.
```

---

## 4. Spotify MCP

### OAuth flow

1. User clicks “Connect Spotify” in Runway Settings.
2. Runway redirects to Spotify authorize.
3. Spotify callback exchanges code for tokens.
4. Tokens encrypted and stored in Supabase `user_tokens`.
5. Kimi MCP client reads tokens at runtime to call Spotify tools.

### MCP server capabilities

| Tool | Description |
|------|-------------|
| `spotify_search` | Search tracks, albums, artists |
| `spotify_get_playlists` | List user playlists |
| `spotify_create_playlist` | Create a new playlist |
| `spotify_add_tracks` | Add tracks to a playlist |
| `spotify_get_audio_features` | Get tempo/energy/valence/etc. |
| `spotify_get_recommendations` | Get recommendations based on seeds |

### Kimi prompt templates

```text
Build a Spotify playlist for "beach vibes" with laid-back house and indie dance.
Target BPM 110-124, high valence, medium energy. Return 25 tracks with Spotify IDs.
```

```text
Find underground tracks matching the energy of agent CLAUDE's "[playlist_name]"
playlist. Use audio features to match tempo, danceability, and instrumentalness.
```

```text
Cross-reference the Tidal playlist [tidal_playlist_id] on Spotify. For each track,
search by ISRC first, then by title + artist. Return a Spotify track ID mapping.
```

---

## 5. Unified Music Agent

The Unified Music Agent decides which service(s) to call and how to merge results.

### Responsibilities

- Accept a natural-language request from Kimi.
- Parse intent: search, create playlist, recommend, sync, export.
- Query Tidal and/or Spotify based on user connections.
- Fallback: if a track is unavailable on one service, search the other.
- Apply Runway-specific context: agent style (KIMI vs CLAUDE), prompt metadata, Dekan/Jim taste profiles.
- Return structured results for the Runway API to persist.

### Fallback logic

```
search track on Tidal
    ↓
if not found or user not connected to Tidal
    search on Spotify
    ↓
if found on either
    return track + available service IDs
else
    mark as unavailable
```

### Character-aware playlist generation

```text
Generate a playlist for the Runway prompt "[prompt_name]".
Consider:
- Genre: [genre]
- Energy: [energy]
- BPM range: [bpm_min]-[bpm_max]
- Label preference: [label]
- Recent release window: [release_date_range]
- Excluded playlist: [exclude_playlist_id]
- Agent style: [KIMI | CLAUDE]

Return exactly [limit] tracks, each with title, artist, album, source,
and external ID for Tidal and/or Spotify.
```

---

## 6. MCP Server Config Examples

### `mcp-tidal.json`

```json
{
  "mcpServers": {
    "tidal": {
      "command": "node",
      "args": ["/path/to/tidal-mcp-server/dist/index.js"],
      "env": {
        "TIDAL_CLIENT_ID": "${TIDAL_CLIENT_ID}",
        "TIDAL_CLIENT_SECRET": "${TIDAL_CLIENT_SECRET}",
        "TIDAL_REDIRECT_URI": "${NEXT_PUBLIC_SITE_URL}/api/tidal/callback"
      }
    }
  }
}
```

### `mcp-spotify.json`

```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["/path/to/spotify-mcp-server/dist/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "${SPOTIFY_CLIENT_ID}",
        "SPOTIFY_CLIENT_SECRET": "${SPOTIFY_CLIENT_SECRET}",
        "SPOTIFY_REDIRECT_URI": "${NEXT_PUBLIC_SITE_URL}/api/spotify/callback"
      }
    }
  }
}
```

### `mcp-unified-music-agent.json`

```json
{
  "mcpServers": {
    "runway-music-agent": {
      "command": "python",
      "args": ["/path/to/runway/agents/unified_music_agent.py"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}",
        "TIDAL_MCP_CMD": "node",
        "SPOTIFY_MCP_CMD": "node"
      }
    }
  }
}
```

---

## 7. Migration Steps

1. **Security cleanup first**
   - Rotate exposed Supabase/Tidal/Spotify keys.
   - Move all credentials to environment variables.

2. **Add Spotify OAuth routes**
   - Create `/api/spotify/auth` and `/api/spotify/callback` mirroring Tidal.

3. **Create Unified Music Agent**
   - New file: `agents/unified_music_agent.py`
   - Reads `user_tokens`, calls Tidal/Spotify MCP servers, merges results.

4. **Refactor API routes**
   - Replace direct REST calls in `lib/music.ts` with Unified Music Agent calls.
   - Update `/api/discover`, `/api/run-prompt`, `/api/recommend-similar`.

5. **Update Settings UI**
   - Add “Connect Spotify” button.
   - Show connection status for both services.

6. **Replace agent runner polling**
   - Instead of polling `agent_runs`, call the Unified Music Agent directly from API routes or a queue worker.

7. **Update database**
   - Add `user_id` columns to `playlists`, `tracks`, and `agent_runs`.
   - Store MCP request/response logs for debugging.

---

## 8. Kimi Prompt Template Library

Save these as `prompts/music-discovery.md` in the repo:

```markdown
# Runway Music Discovery Prompts

## Search
Find tracks matching the Runway prompt "{prompt_name}". Genre: {genre}, energy: {energy}, BPM {bpm_min}-{bpm_max}. Return {limit} tracks.

## Create Playlist
Create a {service} playlist named "{agent}_{prompt_name}" for user {user_id}. Include tracks discovered from prompt {prompt_id}. Fallback to the other service if a track is unavailable.

## Recommend Similar
Given playlist {playlist_id}, find similar tracks on {service}. Prefer recent releases and avoid artists already in the source playlist.

## Cross-reference
For each track in Tidal playlist {tidal_playlist_id}, find the equivalent Spotify track by ISRC or title+artist.

## Trending
What's trending on Beatport/1001Tracklists this week? Cross-reference with {service} and return available tracks.
```
