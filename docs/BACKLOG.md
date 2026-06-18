# Backlog & Known Issues

This file tracks active bugs, pending features, and technical debt for Runway.

## Active Bugs

### Tidal Search Returns 0 Candidates in Some Flows
- **Status:** Partially fixed
- **What was done:**
  - Fixed `Accept` header to `application/vnd.tidal.v1+json`.
  - Added retry/backoff for Tidal `429` rate limits.
  - Added fallback query chain in `/api/run-prompt` for Tidal.
- **Still to verify:**
  - `/api/recommend-similar` with Tidal after `source tracks: 0` fix.
  - Run-prompt with label/BPM queries like `"label:"Drumcode" techno 130-135 bpm"`.
- **Next step:** Test a Tidal "Similar" run and a Tidal prompt. If still zero, inspect Vercel logs and add more aggressive query simplification.

### Beatport Token Refresh Reliability
- **Status:** Implemented, not battle-tested
- **Issue:** Tokens from `api.beatport.com/v4/docs/` expire in 10 minutes. The refresh flow needs `BEATPORT_CLIENT_ID` (and possibly `BEATPORT_CLIENT_SECRET`) to match the client in the JWT.
- **Next step:** Confirm refresh works on production after a token expires. If refresh fails, implement UI flow to re-paste token easily.

## Pending Features

### 1. Beatport User Playlists
- Beatport's public API does not expose user playlists. The sync currently falls back to genre/top charts.
- **Options:** Monitor Beatport API docs for a user-library endpoint, or integrate with internal Beatport API if acceptable.

### 2. Migration 018 — Prompt Preferred Service
- File: `supabase/migrations/018_prompt_preferred_service.sql`
- Adds `preferred_service` column to `prompts`.
- **Status:** Not yet applied to production. Apply via Supabase SQL Editor.

### 3. Runway-Wide "Agent" Selection
- Agent inference now defaults to `KIMI` to avoid duplicate `CLAUDE_`/`KIMI_` prefixes.
- **Future:** Allow per-run agent override in the UI, or remove agent prefix entirely if no longer useful.

### 4. Playlist Duplicate Prevention
- Unique constraint `(user_id, service, external_id)` is in place, plus migrations 011 and 014 cleaned duplicates.
- **Future:** Add soft-deleted playlist resurrection instead of creating new rows.

### 5. Feed Import Reliability
- Feed scraping scripts exist in `app/api/feed/scrape` and `app/api/feed/youtube`.
- **Future:** Add scheduling (cron) or webhooks instead of manual scraping.

### 6. Rekordbox Export Improvements
- Currently exports tracks matching playlist or today's discoveries.
- **Future:** Add cue point / metadata export and support multiple playlists in one XML.

## Technical Debt

### 1. Clean Up Backup Files
- Many `*.bak` files and old `scripts/*.bak` files exist in the repo.
- **Action:** Delete `.bak` files once current behavior is stable.

### 2. MCP Server References
- `README.md` previously referenced MCP servers. Most discovery now uses direct API integrations.
- **Action:** Remove stale MCP references from docs and env examples if no longer used.

### 3. Type Safety
- Some `any` types remain in `lib/music.ts` and `lib/beatport.ts` for API responses.
- **Action:** Add strict response types for Spotify, Tidal, and Beatport endpoints.

### 4. Error Handling in Sync
- `/api/playlists/sync` catches and logs errors but sometimes returns generic messages.
- **Action:** Surface per-service error details to the UI.

### 5. Environment Variable Audit
- `.env.local.example` may be stale. Ensure it lists all current variables (LLM, Beatport, Tidal, Spotify, Supabase, feed secret).

## Recently Completed

- Tidal `Accept` header fix
- Tidal `429` retry/backoff
- Beatport token paste + refresh flow
- Beatport genre preferences + chart sync
- Beatport token expiry UI state
- Updated README, FRONTEND, BACKEND, and BACKLOG docs
