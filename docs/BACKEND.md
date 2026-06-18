# Backend & API Guide

Runway's backend is implemented as Next.js 14 Route Handlers. All business logic lives in `app/api/**` and shared clients live in `lib/`.

## Authentication

Every protected route calls `getAuthenticatedUser()` from `lib/supabase/server.ts`, which reads the Supabase session from the request cookies. Service-to-service writes (sync, token refresh) use `createServiceClient()` with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/login` | Email/password or magic-link sign in |
| `GET` | `/api/auth/callback` | Supabase auth callback |
| `POST` | `/api/discover` | Start an agent discovery run |
| `POST` | `/api/run-prompt` | Execute a prompt template against a service |
| `POST` | `/api/recommend-similar` | Generate a "Similar" playlist from a source playlist |
| `POST` | `/api/playlist/create` | Persist a generated playlist and tracks |
| `POST` | `/api/playlist/edit` | Rename / update a playlist |
| `POST` | `/api/playlist/delete` | Soft-delete a playlist |
| `POST` | `/api/playlist/sync` | Sync a single playlist back to its service |
| `POST` | `/api/playlists/sync` | Bulk sync playlists from a connected service |
| `POST` | `/api/rate` | Submit a rating for a playlist |
| `GET` | `/api/tracks` | List tracks for the current user |
| `GET/POST` | `/api/feed` | Fetch or ingest feed items |
| `POST` | `/api/feed/scrape` | Scrape 1001Tracklists / Beatport feeds |
| `POST` | `/api/feed/youtube` | Ingest YouTube feed items |
| `POST` | `/api/rekordbox/export` | Export a playlist to Rekordbox XML |
| `POST` | `/api/spotify/auth` | Start Spotify OAuth |
| `GET` | `/api/spotify/callback` | Spotify OAuth callback |
| `POST` | `/api/tidal/auth` | Start Tidal OAuth |
| `GET` | `/api/tidal/callback` | Tidal OAuth callback |
| `POST` | `/api/beatport/token` | Store a pasted Beatport token |
| `GET` | `/api/beatport/genres` | List Beatport genres |
| `GET/POST` | `/api/beatport/preferences` | Load/save Beatport genre preferences |
| `GET` | `/api/beatport/user` | Fetch Beatport profile (best-effort) |

## Service Integrations

### Spotify

- OAuth 2.0 via `/api/spotify/auth` and `/api/spotify/callback`.
- Token stored in `user_tokens`.
- Operations: search, get playlists, get playlist tracks, create playlists, add tracks.

### Tidal

- OAuth 2.0 via `/api/tidal/auth` and `/api/tidal/callback`.
- Uses Tidal OpenAPI v2 (`openapi.tidal.com/v2`) with `Accept: application/vnd.tidal.v1+json`.
- `lib/music.ts` includes retry/backoff for `429 Too Many Requests`.
- Operations: search, get playlists, get playlist tracks, create playlists, add tracks.

### Beatport

- No OAuth UI; users paste a token JSON from `https://api.beatport.com/v4/docs/`.
- `lib/beatport-auth.ts` refreshes expired tokens via `refresh_token` grant.
- Endpoints used:
  - `GET /catalog/search/?q=...&type=tracks`
  - `GET /catalog/charts`
  - `GET /catalog/charts?genre_id=...`
  - `GET /catalog/charts/{id}`
  - `GET /catalog/genres`
  - `GET /my/account/` (best-effort profile)
- Operations: search, sync genre/top charts.

## LLM Layer

Located in `lib/llm/`:

- `client.ts` — unified OpenRouter client with retries and timeouts.
- `query-enhancer.ts` — turns prompt metadata into service-specific search queries.
- `curation.ts` — ranks and filters discovered tracks.
- `playlist-meta.ts` — generates playlist names and descriptions.
- `prompts.ts` — builds system/user prompts.

Default models are selected by `persona` and can be overridden via env vars.

## Database Schema

Key tables (see `supabase/migrations/` for full DDL):

| Table | Purpose |
|-------|---------|
| `users` | Supabase Auth users |
| `user_tokens` | OAuth / pasted tokens per service; includes `preferences`, `service_user_id`, `expires_at`, `refresh_token` |
| `playlists` | Synced and generated playlists; unique on `(user_id, service, external_id)` |
| `tracks` | Discovered tracks; linked to playlists and source service |
| `ratings` | Playlist ratings and feedback |
| `prompts` | Prompt templates with genre/BPM/label filters and `preferred_service` |
| `feed_items` | External source feed items |
| `agent_runs` | Discovery run history with `user_id` |

## Migrations

Run SQL files in `supabase/migrations/` in numeric order. Recent additions:

- `016_user_tokens_beatport.sql` — allow `beatport` in `user_tokens.service`.
- `017_user_tokens_preferences.sql` — add `preferences` JSONB column.
- `018_prompt_preferred_service.sql` — add `preferred_service` hint to prompts.

## Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Service OAuth

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=

TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
```

### Beatport

```env
BEATPORT_CLIENT_ID=
BEATPORT_CLIENT_SECRET=         # optional, may help refresh
```

### LLM (via OpenRouter)

```env
OPENROUTER_API_KEY=
NEXT_PUBLIC_SITE_URL=           # used for OpenRouter referer
LLM_MODEL=                      # optional override
LLM_TIMEOUT_MS=30000
LLM_MAX_RETRIES=3
```

### Optional / Scripts

```env
NEXT_PUBLIC_SITE_URL=
FEED_INGEST_SECRET=             # protects feed ingestion endpoint
RUNWAY_SITE_URL=
RUNWAY_TEST_EMAIL=
RUNWAY_TEST_PASSWORD=
RUNWAY_USER_ID=
```

## CSRF Protection

Mutating API routes check `x-csrf-token` against the token stored in the user's session cookie. Client code uses `apiFetch` from `lib/fetch-client.ts`.

## Row Level Security

RLS is enabled. Users can only read/write their own ratings and tokens. Playlists and tracks are readable by all authenticated users but scoped to the owning user for writes.
