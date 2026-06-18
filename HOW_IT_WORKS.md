# How Runway Works: Prompts → Discovery → Similar

## The Big Picture

Runway has **3 main actions** you can do with a prompt:

| Action | What It Does | API Route |
|--------|-------------|-----------|
| **Run on Tidal** | Searches Tidal using your prompt → creates a Tidal playlist | `POST /api/run-prompt` |
| **Run on Spotify** | Searches Spotify using your prompt → creates a Spotify playlist | `POST /api/run-prompt` |
| **Run on Beatport** | Searches Beatport catalog → saves tracks to Supabase (no external playlist) | `POST /api/run-prompt` |
| **Similar on Tidal** | Takes an existing playlist → finds similar tracks on Tidal → creates new playlist | `POST /api/recommend-similar` |
| **Similar on Beatport** | Takes an existing playlist → finds similar tracks on Beatport → saves to Supabase | `POST /api/recommend-similar` |
| **Similar on Spotify** | Takes an existing playlist → finds similar tracks on Spotify → creates new playlist | `POST /api/recommend-similar` |

---

## 1. What is a Prompt?

A **Prompt** is a search template stored in the `prompts` table:

```
friday_warmup
├── name: "friday_warmup"
├── genre: "techno"
├── energy: "medium"
├── bpm_min: 125
├── bpm_max: 128
├── label: "" (optional)
├── release_date_range: "last_3_months"
├── limit: 30
└── description: "Melodic, building techno for a Friday night warmup"
```

When you click **"Run on Tidal"**, the prompt gets converted into a search query:

```
"techno medium 125-128 bpm"
```

This query is sent to Tidal's API. The results are filtered by release date, deduplicated, optionally curated by LLM, and then either:
- **Created as a new playlist** on Tidal/Spotify (with a name like `KIMI_friday_warmup`)
- **Saved as tracks** in Supabase (for Beatport, which has no playlist API)

---

## 2. How "Run on Tidal/Spotify/Beatport" Works

### Step-by-step:

1. **You click "Run on Tidal"** → frontend sends `POST /api/run-prompt`
   ```json
   {
     "prompt_id": "abc-123",
     "agent": "KIMI",
     "service": "tidal"
   }
   ```

2. **Backend builds the query** from the prompt fields:
   ```
   "techno medium 125-128 bpm"
   ```

3. **Searches the service** (Tidal API, Spotify API, or Beatport API)

4. **Filters results**:
   - Release date must be within `last_3_months` (or whatever the prompt says)
   - Removes duplicates (same title + artist)

5. **LLM Curation** (optional, can fail gracefully):
   - Sends the raw tracks to OpenRouter with a prompt like:
     *"You are KIMI. Pick the 30 best tracks that match 'techno medium 125-128 bpm'..."*
   - If the LLM call fails, uses the raw results instead

6. **Duplicate Prevention**:
   - Before creating a new playlist, `run-prompt` checks if one already exists with the same `prompt_name + agent + service` within the last 24 hours
   - If found → **refreshes** the existing playlist (deletes old tracks, updates metadata)
   - If not found → creates a new playlist
   - The database also enforces a unique constraint on `(user_id, service, external_id)` for synced playlists

7. **Creates or refreshes the playlist** on the external service (Tidal/Spotify) or virtual playlist for Beatport

8. **Saves to Supabase**:
   - Playlist record in `playlists` table
   - Track records in `tracks` table (linked to the playlist via `playlist_id`)

---

## 3. How "Similar on Tidal/Spotify/Beatport" Works

This is the **recommendation engine**. You click it on any existing playlist.

### Step-by-step:

1. **You click "Similar on Tidal"** on a playlist called "Dekan - New Favs" → frontend sends `POST /api/recommend-similar`
   ```json
   {
     "playlist_id": "playlist-uuid",
     "agent": "KIMI",
     "service": "tidal"
   }
   ```

2. **Backend fetches the source playlist tracks** from the external service:
   - Tidal: fetches all tracks from the Tidal playlist
   - Spotify: fetches all tracks from the Spotify playlist
   - Beatport: fetches all tracks from the Beatport chart

3. **Analyzes the source** to build search queries:
   - Extracts top 5 artists from the playlist
   - Extracts genre tags from the playlist name (e.g., `[techno]` → "techno")
   - Builds multiple queries:
     ```
     "techno raw hard"
     "Adam Beyer techno"
     "Drumcode techno"
     "Joseph Capriati techno"
     ```

4. **LLM Query Enhancement** (optional):
   - Sends the source playlist metadata to OpenRouter
   - LLM suggests better search queries based on the playlist's vibe
   - If LLM fails, falls back to the built-in query builder

5. **Runs searches** for each query on the target service

6. **Collects candidates** (all unique tracks from all queries)

7. **Diversity Selection** (new — this is the key fix):
   - **Excludes** any track already in the source playlist (no duplicates!)
   - **Scores** each track by relevance:
     - +3 if same artist as source
     - +2 if genre tag matches
     - +1.5 if metadata tag matches
     - +0.5 if released recently
   - **Greedy diversity algorithm** picks tracks one by one:
     - First pick: highest score
     - Second pick: highest score from a DIFFERENT artist (penalty of -2.0 per existing track from same artist)
     - Third pick: again prioritizes under-represented artists
     - Result: 20 tracks from ~15 different artists instead of 20 tracks from 3 artists

8. **Creates the playlist** with name like `KIMI_Similar_to_Dekan - New Favs`

9. **Saves to Supabase** with `prompt_name: "similar:Dekan - New Favs"`

---

## 4. The Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Prompts   │────▶│  Discovery  │────▶│  Playlists  │
│  (templates)│     │  (API routes)│     │  (external +│
│             │     │              │     │   Supabase) │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │   Similar   │
                                        │  (recommend- │
                                        │   similar)    │
                                        └─────────────┘
```

### Tables involved:

| Table | Stores |
|-------|--------|
| `prompts` | Your search templates (friday_warmup, warehouse_peak, etc.) |
| `playlists` | External playlist references (Tidal/Spotify/Beatport) + metadata |
| `tracks` | Individual discovered tracks (linked to playlists via `playlist_id`) |
| `agent_runs` | Audit log of every discovery/recommendation run |
| `user_tokens` | OAuth tokens for Tidal/Spotify/Beatport |
| `feed_items` | Scraped tracks from Beatport/1001Tracklists/YouTube |

---

## 5. Key Fixes Applied

### Diversity ("one note" problem)
**Before**: Recommendations were just the top 20 highest-scored tracks. If Adam Beyer had 8 high-scoring tracks, you'd get 8 Adam Beyer tracks.

**After**: Greedy algorithm picks tracks while penalizing over-represented artists. 20 tracks from ~15 different artists.

### Duplicate Prevention
**Before**: Running "Run on Tidal" twice on the same prompt created 2 separate playlists.

**After**: Within 24 hours, the same `prompt_name + agent + service` combination refreshes the existing playlist instead of creating a new one. For synced playlists, the database enforces `UNIQUE (user_id, service, external_id)` so re-syncing updates existing rows.

### Source Track Exclusion
**Before**: "Similar to X" could include tracks already in X.

**After**: All tracks from the source playlist are excluded from the candidate pool before selection begins.

---

## 6. How to Use It

### Creating a New Discovery Prompt

1. Go to **Prompts** page
2. Click **New Prompt**
3. Fill in:
   - **Name**: `peak_time_weapons`
   - **Genre**: `techno`
   - **Energy**: `high`
   - **BPM**: 130-135
   - **Label**: `Drumcode` (optional)
   - **Limit**: 25
   - **Description**: `Raw, driving peak-time techno`
4. Click **Create**

### Running Discovery

1. Find your prompt card
2. Click **Run on Tidal** (or Spotify/Beatport)
3. Wait ~10-30 seconds
4. New playlist appears in the **Playlists** page

### Getting Similar Recommendations

1. Go to **Playlists** page
2. Find any playlist (yours or imported)
3. Click **Similar on Tidal** (or Beatport/Spotify)
4. New "Similar to..." playlist is created with diverse tracks

---

## 7. The Beatport Difference

Beatport is **read-only** for playlists — you can search and discover tracks, but you can't create playlists on Beatport via API.

So for Beatport:
- **"Run on Beatport"** → searches Beatport catalog → saves tracks to Supabase only (no external playlist)
- **"Similar on Beatport"** → searches Beatport catalog → saves tracks to Supabase only
- **Import Beatport** → syncs Beatport charts (not user playlists) into Supabase as "playlists"

To actually DJ with these tracks, you'd need to:
1. Run discovery on Beatport
2. Then click **Similar on Tidal** to create a Tidal playlist with matching tracks
3. Or manually search the tracks in your DJ software

---

## 8. Files That Actually Matter Now

| File | Purpose |
|------|---------|
| `app/api/run-prompt/route.ts` | Creates playlists from prompts (diversity + dedup) |
| `app/api/recommend-similar/route.ts` | Creates "similar to" playlists (diversity + source exclusion) |
| `app/api/discover/route.ts` | General discovery (no playlist creation, just tracks) |
| `app/api/playlists/sync/route.ts` | Syncs external playlists into Supabase |
| `lib/beatport.ts` | Beatport API client |
| `lib/llm/` | OpenRouter integration for LLM curation |
| `agents/feed_agent.py` | Scrapes Beatport/1001Tracklists (standalone, optional) |
| `agents/runway_client.py` | Python Supabase client (for scripts) |
| `agents/seed_prompts.py` | Seeds default prompts |

**Archived (broken)**:
`agents/archive/discovery.py`, `smart_discovery.py`, `playlist.py`, `discovery_production.py`, `playlist_production.py`

---

## 9. Common Gotchas

1. **"No tracks found"** → Check that your Tidal/Spotify/Beatport token is connected in Settings
2. **Duplicate playlists** → Shouldn't happen anymore thanks to the unique constraint. If you see duplicates, run migration `014_dedupe_playlists_final.sql` in the Supabase SQL Editor to clean old data.
3. **"One note" recommendations** → Fixed with the diversity algorithm. If still bad, the source playlist might be too narrow.
4. **Beatport tracks don't appear in DJ software** → Beatport is catalog-only. Use Tidal/Spotify for actual DJ playlists.
