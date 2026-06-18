# Runway

Music discovery dashboard for Dekan & Jim — powered by KIMI and CLAUDE agents discovering tracks across Spotify and Tidal.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/runway&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SPOTIFY_MCP_CMD,SPOTIFY_MCP_CWD,TIDAL_MCP_CMD,TIDAL_MCP_CWD)

## Stack

- **Next.js 14** — App Router, Server Components
- **Supabase** — Postgres + Auth + RLS
- **Tailwind CSS** — Dark mode default
- **Vercel** — Deployment

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Today's discoveries, match rates, agent run feed |
| Playlists | `/playlists` | All KIMI_ / CLAUDE_ playlists, filterable by service & agent |
| Prompts | `/prompts` | Create and manage discovery prompt templates |
| Ratings | `/ratings` | Star ratings + feedback, Dekan vs Jim side-by-side |
| Feed | `/feed` | Beatport, 1001Tracklists, YouTube — click to discover similar |

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/runway.git
cd runway
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **SQL Editor**, paste and run `supabase/migrations/001_initial.sql` to create all tables, indexes, and RLS policies.
3. In **Authentication → Users**, create two users (Dekan and Jim) with email/password.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

SPOTIFY_MCP_CMD=powershell.exe
SPOTIFY_MCP_ARGS=-ExecutionPolicy,Bypass,-File,C:\Users\Dekan AI Brother\Projects\01_ACTIVE\mcp-servers\spotify-mcp\run-server.ps1

TIDAL_MCP_CMD=powershell.exe
TIDAL_MCP_ARGS=-ExecutionPolicy,Bypass,-File,C:\Users\Dekan AI Brother\Projects\01_ACTIVE\mcp-servers\tidal-mcp\run-server.ps1
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with one of the Supabase users.

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or use the **Deploy with Vercel** button above. Set all env vars in the Vercel dashboard.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/discover` | Create an agent run (returns `run_id`) |
| `POST` | `/api/playlist/create` | Save a playlist to the DB |
| `POST` | `/api/rate` | Submit or update a rating |
| `GET`  | `/api/feed` | Fetch feed items (query: `source`, `limit`, `unprocessed`) |
| `POST` | `/api/feed` | Ingest feed items (array or single object) |
| `POST` | `/api/rekordbox/export` | Generate Rekordbox XML download |

### POST /api/discover

```json
{ "prompt_id": "uuid", "agent": "CLAUDE" }
```

Returns `{ run_id, agent, prompt_name, status: "running" }`. Your MCP agent should then update the `agent_runs` row via the service role key when complete.

### POST /api/playlist/create

```json
{
  "name": "CLAUDE_Peak_Techno_2024",
  "agent": "CLAUDE",
  "service": "spotify",
  "external_id": "spotify_playlist_id",
  "track_ids": [],
  "prompt_name": "Peak Time Techno"
}
```

### POST /api/rekordbox/export

```json
{ "playlist_id": "uuid" }
// or
{ "track_ids": ["uuid", "uuid"] }
// or empty body → exports today's discoveries
```

Returns an `application/xml` download (`runway-{timestamp}.xml`).

## Database Schema

```
playlists   — id, name, agent, service, external_id, track_count, prompt_name, created_at
tracks      — id, title, artist, album, source, isrc, discovered_by, prompt_name, discovered_at
ratings     — id, playlist_id, rated_by, rating(1-5), feedback, tracks_kept, tracks_removed
prompts     — id, name, label, genre, energy, bpm_min, bpm_max, timeframe, limit, description
feed_items  — id, source, title, artist, url, genre, label, published_at, processed
agent_runs  — id, agent, prompt_name, tracks_found, tracks_matched, started_at, completed_at, status
```

RLS is enabled. Users only see their own ratings. All playlists, tracks, and feed items are readable by all authenticated users.

## MCP Agent Integration

The dashboard creates `agent_run` records via `POST /api/discover`. Your MCP agent (Claude Code or Kimi) should:

1. Read the `agent_run` by `run_id` from Supabase
2. Use the Spotify or Tidal MCP server to discover tracks matching the prompt
3. `INSERT` discovered tracks into the `tracks` table
4. `UPDATE` the `agent_run` with `tracks_found`, `tracks_matched`, `completed_at`, `status = 'completed'`
5. Optionally call `POST /api/playlist/create` to save the playlist

Use `SUPABASE_SERVICE_ROLE_KEY` for agent writes (bypasses RLS).

## Project Structure

```
runway/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected pages (shared sidebar layout)
│   │   ├── page.tsx           # Dashboard
│   │   ├── playlists/
│   │   ├── prompts/
│   │   ├── ratings/
│   │   └── feed/
│   └── api/                   # API routes
├── components/
│   └── nav.tsx                # Sidebar navigation
├── lib/
│   ├── types.ts               # TypeScript interfaces
│   └── supabase/              # Browser + server clients
├── supabase/migrations/       # SQL schema
├── middleware.ts              # Auth protection + token refresh
└── tailwind.config.ts
```
