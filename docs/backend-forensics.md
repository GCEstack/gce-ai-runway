# Runway — Backend Forensics

**Project:** Runway Music Discovery Dashboard  
**Location:** `C:/Users/Dekan AI Brother/runway/app/api/`, `lib/`, `supabase/migrations/`  

---

## 1. API Endpoint Inventory

| Method | Route | Auth | Purpose | Notes |
|--------|-------|------|---------|-------|
| `POST` | `/api/auth/login` | No | Custom Supabase password login | Re-implements auth; non-HttpOnly cookies |
| `GET` | `/api/auth/callback` | No | Supabase OAuth callback | No state validation; open redirect via `next` |
| `POST` | `/api/discover` | Yes | Run discovery from prompt/feed | Service-role writes; shared tables |
| `POST` | `/api/run-prompt` | Yes | Create playlist from prompt | Service-role writes; no owner column |
| `POST` | `/api/recommend-similar` | Yes | Recommend similar tracks | Can read any playlist |
| `POST` | `/api/playlist/create` | Yes | Create playlist record | No owner association |
| `POST` | `/api/playlist/delete` | Yes | Soft-delete playlist + service delete | No ownership check |
| `PATCH` | `/api/playlist/edit` | Yes | Edit name/comments + sync service | No ownership check |
| `POST` | `/api/playlist/sync` | Yes | Check existence of one/all playlists | Updates status of any playlist |
| `POST` | `/api/playlists/sync` | Yes | Bulk import from Spotify/Tidal | No ownership check; accepts `access_token` in body |
| `POST/GET` | `/api/playlists/[id]/metadata` | Yes | Save/get playlist metadata | No ownership check |
| `POST` | `/api/playlists/[id]/sync-description` | Yes | Push description to Tidal | No ownership check |
| `GET/PATCH` | `/api/playlists/[id]/tracks` | Yes | List/update tracks in playlist | No user authorization |
| `GET` | `/api/feed` | Yes | List feed items | Correctly authenticated |
| `POST` | `/api/feed` | **No** | Ingest feed items | **Missing authentication** |
| `POST` | `/api/feed/scrape` | Yes | Spawns `feed_agent.py` via `execSync` | Shell command execution risk |
| `POST` | `/api/feed/youtube` | Yes | Add YouTube links | Weak URL hostname validation |
| `POST` | `/api/rate` | Yes | Submit playlist rating | Correctly sets `rated_by` |
| `POST` | `/api/rekordbox/export` | Yes | Export XML | No ownership check |
| `GET` | `/api/tidal/auth` | Yes | Start Tidal OAuth PKCE | Verbose logging |
| `GET` | `/api/tidal/callback` | Yes | Tidal OAuth callback | Verbose logging |
| `GET` | `/api/tracks` | Yes | List tracks + debug payload | Returns debug/sample row |

---

## 2. Voice / Music Pipeline Flow

The application does not have a real-time voice pipeline; it has a **music discovery pipeline**:

```
User selects prompt/feed item
        ↓
/api/discover or /api/run-prompt
        ↓
Fetch user_token for Spotify/Tidal
        ↓
Search Spotify/Tidal API (lib/music.ts)
        ↓
Filter by release date, deduplicate
        ↓
Insert tracks into Supabase tracks table
        ↓
Optionally create playlist on service
        ↓
Update agent_runs status
```

**Pipeline files:**
- `app/api/discover/route.ts` lines 41–145
- `app/api/run-prompt/route.ts` lines 51–207
- `lib/music.ts` lines 70–117 (search), 235–330 (playlist creation)

---

## 3. Concurrency Model

- **Next.js API routes** are serverless/stateless.
- **No WebSockets** are used.
- **Polling:**
  - Frontend polls `agent_runs` every 3 seconds (`app/(dashboard)/feed/page.tsx` lines 149–161).
  - `scripts/agent-runner.mjs` polls Supabase every 5 seconds (line 54).
- **Max simultaneous sessions:** Limited by Vercel concurrency and Supabase connection pool; no explicit limits in code.

---

## 4. Database Schema

| Table | Key Columns | RLS | Policy Issues |
|-------|-------------|-----|---------------|
| `playlists` | `id`, `name`, `agent`, `service`, `external_id`, `track_count`, `prompt_name`, `status`, `tags`, `comments`, `energy`, `rating`, `created_at`, `updated_at` | Enabled | Only `SELECT`/`INSERT`; **no UPDATE/DELETE policies** |
| `tracks` | `id`, `title`, `artist`, `album`, `source`, `isrc`, `discovered_by`, `prompt_name`, `discovered_at`, `tags`, `comments`, `keep_remove`, `playlist_id`, `release_date` | Enabled | `SELECT`/`INSERT`; **no UPDATE/DELETE policies** |
| `ratings` | `id`, `playlist_id`, `rated_by`, `rating`, `feedback`, `tracks_kept`, `tracks_removed`, `created_at` | Enabled | Correctly scoped to `rated_by = auth.uid()` |
| `prompts` | `id`, `name`, `label`, `genre`, `energy`, `bpm_min`, `bpm_max`, `timeframe`, `release_date_range`, `exclude_playlist`, `limit`, `description`, `created_by`, `created_at` | Enabled | `INSERT` requires `created_by = auth.uid()`; UI does not send it |
| `feed_items` | `id`, `source`, `title`, `artist`, `url`, `genre`, `label`, `published_at`, `processed` | Enabled | `SELECT`/`INSERT` for any authenticated user |
| `agent_runs` | `id`, `agent`, `prompt_name`, `tracks_found`, `tracks_matched`, `started_at`, `completed_at`, `status` | Enabled | `UPDATE` policy is `USING (true)` |
| `user_tokens` | `id`, `user_id`, `service`, `access_token`, `refresh_token`, `expires_at`, `service_user_id`, `created_at`, `updated_at` | Enabled | Correctly scoped to `user_id = auth.uid()` |

**Critical gap:** No `user_id` / ownership column on `playlists`, `tracks`, or `agent_runs`.

---

## 5. Caching Strategy

- **No Redis or in-memory cache** is used.
- Next.js `fetch()` is used with `{ next: { revalidate: 0 } }` in some routes (e.g., `app/api/feed/youtube/route.ts` line 14) to disable caching.
- All Supabase queries hit the database directly.

---

## 6. Error Handling

| Pattern | Coverage | Gaps |
|---------|----------|------|
| Try/catch around JSON parsing | Most routes | Some routes return raw `error.message` to client |
| Try/catch around external API calls | `lib/music.ts` | Errors are logged and empty arrays returned, masking failures |
| Service-call error handling | Partial | `app/api/feed/scrape/route.ts` catches exec errors but not command-injection risk |

---

## 7. Rate Limiting

- **No rate limiting** is implemented in the application code.
- Relies on Vercel edge limits and Supabase rate limits.
- `app/api/tracks/route.ts` caps `limit` at 1000 but does not throttle per user.

---

## 8. Logging

- Logging is **unstructured** `console.error` / `console.log`.
- **PII/credential leakage:** Tidal OAuth routes log partial client IDs, redirect URIs, state, and code prefixes.
- No alerting hooks or correlation IDs.

---

## 9. Backend Performance Issues

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| Medium | `app/api/run-prompt/route.ts` | 115–126, 165–176 | Inserts tracks one-by-one | Batch insert with `supabase.from('tracks').insert(rows[])` |
| Medium | `app/api/recommend-similar/route.ts` | 283–296 | Inserts tracks one-by-one | Batch insert |
| Medium | `app/api/discover/route.ts` | 115–126 | Inserts tracks one-by-one | Batch insert |
| Medium | `app/api/feed/scrape/route.ts` | 36–38 | `execSync` blocks Node.js event loop up to 120s | Use async `spawn` with streaming output |
| Medium | `app/api/playlists/sync/route.ts` | 202–214, 246–259 | Upserts playlists one at a time | Batch upsert where rate limits allow |
| Low | `app/api/tracks/route.ts` | 23–35 | Extra diagnostic count/sample queries run on every request | Remove debug-only queries |

---

## 10. Blocking I/O / Async Issues

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| High | `app/api/feed/scrape/route.ts` | 36–38 | `execSync` is synchronous and blocks the event loop | Replace with async `spawn` |
| Medium | `app/api/discover/route.ts` | 115–126 | Awaits each `insert` in a `for...of` loop | Use `Promise.all` or batch insert |
| Medium | `app/api/run-prompt/route.ts` | 165–176 | Awaits each track insert | Batch insert |
| Medium | `app/api/recommend-similar/route.ts` | 283–296 | Awaits each track insert | Batch insert |

---

## 11. Input Validation Gaps

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| High | `app/api/feed/scrape/route.ts` | 19, 36–38 | `source` is interpolated into shell command | Use strict enum + `execFile` |
| Medium | `app/api/feed/youtube/route.ts` | 23–38 | `url.hostname.includes('youtube.com')` allows `youtube.com.evil.com` | Allow-list exact hostnames |
| Medium | `app/api/auth/callback/route.ts` | 7–30 | `next` parameter used for redirect without validation | Validate `next` is a relative path |
| Medium | `app/api/playlists/sync/route.ts` | 154–157 | Accepts `access_token` in request body | Do not accept tokens from client; read from `user_tokens` |
| Low | Most API routes | — | No schema validation (Zod) on request bodies | Add Zod schemas |

---

## 12. Code Quality Issues

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| Medium | `lib/music.ts` | 36, 42, 47, 100–107 | Heavy use of `any`; duplicated constants | Add types; centralize constants |
| Medium | `app/api/tracks/route.ts` | 75–84 | Debug endpoint leaks internal row data | Strip debug payload in production |
| Low | `app/api/feed/route.ts` | 38 | Comment says “server-to-server” but no auth/secret enforced | Align implementation with comment |
| Low | `app/api/auth/login/route.ts` | 27 | Cookie name hardcoded to project ref | Derive from env or use Supabase SSR defaults |
