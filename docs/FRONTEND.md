# Frontend Guide

The Runway UI is a Next.js 14 App Router application using React Server Components by default and client components only where interactivity is needed.

## Layout

- `app/(dashboard)/layout.tsx` — protected shell with sidebar navigation on desktop and bottom navigation on mobile.
- `app/(auth)/login/page.tsx` — Supabase magic-link / email login.
- `middleware.ts` — guards dashboard routes and refreshes the Supabase session cookie.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Today's discoveries, stats, recent agent runs |
| Playlists | `/playlists` | All synced/generated playlists, filterable by service & agent |
| Playlist Detail | `/playlists/[id]` | Tracks inside a playlist with actions |
| Prompts | `/prompts` | Create/edit prompt templates for discovery |
| Tracks | `/tracks` | Track library, filters, and search |
| Ratings | `/ratings` | Star ratings and feedback (Dekan vs Jim) |
| Feed | `/feed` | External sources: Beatport, 1001Tracklists, YouTube |
| Settings | `/settings` | Connect Spotify/Tidal/Beatport, genre preferences, sync triggers |

## Key Components

- `components/nav.tsx` — Sidebar navigation.
- `components/BottomNav.tsx` — Mobile navigation.
- `components/GlassCard.tsx` — Primary card container (frosted glass aesthetic).
- `components/ServiceBadge.tsx` — Spotify / Tidal / Beatport badges with colors.
- `components/AgentBadge.tsx` — KIMI / CLAUDE agent labels.
- `components/StarRating.tsx` — Rating input/display.
- `components/CopyButton.tsx` — Copy-to-clipboard helper.
- `components/CsrfProvider.tsx` — Injects CSRF token into client fetch context.

## Authentication

- Uses Supabase Auth with email/password or magic link.
- Server-side user lookup via `lib/supabase/server.ts` → `getAuthenticatedUser()`.
- Client-side Supabase client via `lib/supabase/client.ts`.

## CSRF Protection

Client API calls go through `lib/fetch-client.ts` (`apiFetch`), which:

1. Reads a CSRF token from a `<meta name="csrf-token">` tag.
2. Sends it as the `x-csrf-token` header on mutating requests.
3. Falls back to a standard `fetch` if no token is present.

`CsrfProvider` renders the meta tag from the server layout.

## Service Connection UI

### Spotify & Tidal

- OAuth flow triggered from `/api/spotify/auth` or `/api/tidal/auth`.
- Callback routes exchange code for tokens and store them in `user_tokens`.
- "Sync now" fetches playlists from the service.

### Beatport

- No OAuth; users paste a token JSON from `https://api.beatport.com/v4/docs/`.
- UI shows:
  - **Connected** badge when token is valid and not expired.
  - **Token expired** badge + **Reconnect** button when expired.
  - **Pick genres** button to select genre preferences.
- Genre preferences are saved to `user_tokens.preferences`.

## Styling

- **Tailwind CSS** with a custom dark theme.
- Theme colors are defined in `tailwind.config.ts` and use CSS variables for runtime switching.
- Common utility classes: `bg-background`, `text-text-primary`, `border-white/[0.08]`.

## Forms & State

- Forms use local React state (`useState`).
- Server mutations are triggered from client event handlers, not `<form action>`.
- Loading and error states are handled inline with spinners and toast-style messages.

## Environment Variables (Runtime)

The frontend only needs:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

All service secrets and LLM keys stay server-side.
