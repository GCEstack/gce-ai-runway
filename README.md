# Runway

Music discovery dashboard for Dekan & Jim — AI-assisted playlist curation across **Spotify**, **Tidal**, and **Beatport**.

Built with Next.js 14, Supabase, Tailwind CSS, and LLM-powered query enhancement.

## Stack

- **Next.js 14** — App Router, Server Components, Route Handlers
- **Supabase** — Postgres + Auth + Row Level Security
- **Tailwind CSS** — Dark mode default
- **Vercel** — Production deployments
- **LLM providers** — OpenAI / Anthropic for query enhancement and curation

## Supported Services

| Service | Auth | Sync | Search | Create Playlist | Similar Recommendations |
|---------|------|------|--------|-----------------|-------------------------|
| Spotify | OAuth | ✅ Playlists | ✅ | ✅ | ✅ |
| Tidal | OAuth | ✅ Playlists | ✅ | ✅ | ✅ |
| Beatport | Token paste + refresh | ✅ Charts/Top 100 | ✅ | — | ✅ |

## Quick Start

```bash
git clone https://github.com/GCEstack/gce-ai-runway.git
cd gce-ai-runway
npm install
```

Copy and fill in environment variables:

```bash
cp .env.local.example .env.local
```

Run migrations in Supabase SQL Editor in order (`supabase/migrations/*.sql`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
runway/
├── app/
│   ├── (auth)/                 # Login page
│   ├── (dashboard)/            # Protected app pages
│   └── api/                    # API route handlers
├── components/                 # Shared UI components
├── lib/
│   ├── music.ts                # Spotify / Tidal client
│   ├── beatport.ts             # Beatport catalog client
│   ├── beatport-auth.ts        # Beatport token refresh
│   ├── llm/                    # LLM query enhancement & curation
│   ├── supabase/               # Browser + server clients
│   ├── fetch-client.ts         # CSRF-safe apiFetch
│   └── types.ts                # TypeScript interfaces
├── scripts/                    # Admin / debugging scripts
├── supabase/migrations/        # Schema migrations
├── docs/                       # Documentation
│   ├── FRONTEND.md
│   ├── BACKEND.md
│   └── BACKLOG.md
└── middleware.ts               # Auth protection
```

## Documentation

- [Frontend Guide](docs/FRONTEND.md)
- [Backend & API Guide](docs/BACKEND.md)
- [Backlog & Known Issues](docs/BACKLOG.md)

## Deploy

```bash
vercel --prod
```

Make sure all required environment variables are set in the Vercel dashboard before deploying.
