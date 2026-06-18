# Runway — Frontend Forensics

**Project:** Runway Music Discovery Dashboard  
**Location:** `C:/Users/Dekan AI Brother/runway/`  
**Scope:** `app/`, `components/`, `lib/`, `middleware.ts`, `tailwind.config.ts`, `next.config.mjs`  

---

## 1. Component Hierarchy

### Root shell

| File | Lines | Responsibility |
|------|-------|----------------|
| `app/layout.tsx` | 1–19 | HTML shell, dark mode (`className="dark"`), Google Fonts preconnect |
| `app/globals.css` | 1–156 | CSS variables, aurora background, scroll/tilt animations |
| `app/(dashboard)/layout.tsx` | 1–24 | Auth-guarded dashboard shell: `SideNav`, `MobileHeader`, `BottomNav`, `AuroraBackground` |

### Pages

| Page | File | Lines | Responsibility |
|------|------|-------|----------------|
| Login | `app/(auth)/login/page.tsx` | 1–171 | Email/password form (ships hardcoded test accounts) |
| Dashboard | `app/(dashboard)/page.tsx` | 1–217 | Stats, recent agent runs, today’s playlists |
| Playlists | `app/(dashboard)/playlists/page.tsx` | 1–673 | Filters, import, edit/delete/recommend actions |
| Playlist detail | `app/(dashboard)/playlists/[id]/page.tsx` | 1–428 | Metadata editor, track keep/remove, Tidal sync |
| Prompts | `app/(dashboard)/prompts/page.tsx` | 1–474 | CRUD for prompts, run on Spotify/Tidal |
| Ratings | `app/(dashboard)/ratings/page.tsx` | 1–306 | Compare ratings between two users |
| Feed | `app/(dashboard)/feed/page.tsx` | 1–434 | Beatport/1001Tracklists/YouTube feed + discover |
| Settings | `app/(dashboard)/settings/page.tsx` | 1–251 | Tidal OAuth connect, sync commands, Spotify notes |
| Tracks | `app/(dashboard)/tracks/page.tsx` | 1–227 | Grouped track browser with filters |
| Gian Lucca | `app/gian-lucca/page.tsx` | 1–237 | Public kids page with videos/audio |

### Shared components

| Component | File | Lines | Responsibility |
|-----------|------|-------|----------------|
| `SideNav` | `components/nav.tsx` | 1–96 | Desktop navigation + sign out |
| `BottomNav` | `components/BottomNav.tsx` | 1–41 | Mobile tab bar |
| `MobileHeader` | `components/MobileHeader.tsx` | 1–89 | Mobile header + profile sheet |
| `AgentBadge` | `components/AgentBadge.tsx` | 1–24 | KIMI/CLAUDE label pill |
| `ServiceBadge` | `components/ServiceBadge.tsx` | 1–24 | Spotify/Tidal label pill |
| `FilterPill` | `components/FilterPill.tsx` | 1–23 | Toggle pill button |
| `GlassCard` | `components/GlassCard.tsx` | 1–43 | Frosted card container |
| `StatCard` | `components/StatCard.tsx` | 1–25 | Dashboard stat tile |
| `StarRating` | `components/StarRating.tsx` | 1–58 | 5-star rating input |
| `CopyButton` | `components/CopyButton.tsx` | 1–53 | Clipboard copy with fallback |
| `AuroraBackground` | `components/AuroraBackground.tsx` | 1–12 | Decorative background wrapper |

---

## 2. State Management

- **No global state library** (Redux, Zustand, or Context) is used.
- Each page owns local `useState`/`useEffect` and talks to Supabase via the browser client (`@/lib/supabase/client`).
- Server Components fetch initial data with the server Supabase client (`@/lib/supabase/server`).
- Mutations are done via `fetch()` to internal API routes; the UI then reloads lists.
- Some prop-drilling exists, e.g., `PlaylistCard` receives many handlers from `PlaylistsPage`.

**Implication:** As the app grows, prop-drilling and duplicated `useEffect` data fetching will become harder to maintain. Consider Zustand or React Query for server-state caching.

---

## 3. Supabase Client Integration

| Client | File | Lines | Usage |
|--------|------|-------|-------|
| Browser client | `lib/supabase/client.ts` | 1–15 | Used in `'use client'` components |
| Server client | `lib/supabase/server.ts` | 1–47 | Used in Server Components and API routes (anon key) |
| Service client | `lib/supabase/server.ts` | 34–47 | Used in API routes to bypass RLS |

The `cleanEnv` helper strips BOM characters, which suggests previous env-file encoding issues.

---

## 4. Data Fetching Patterns

- **Server Components:** Dashboard home, layout auth guard.
- **Client Components:** Most interactive pages (playlists, prompts, feed) fetch on mount and after mutations.
- **Polling:** Feed page polls `agent_runs` every 3 seconds (`app/(dashboard)/feed/page.tsx` lines 149–161, 187–215).
- **No SWR/React Query:** No caching, deduplication, or stale-while-revalidate strategy.

---

## 5. Mobile / Responsiveness / Theming

- **Tailwind config** (`tailwind.config.ts`) defines custom colors and screens.
- **Dark mode** is forced via `className="dark"` on `<html>`; no theme toggle.
- **Mobile navigation** uses `BottomNav` + `MobileHeader` below the Tailwind `lg` breakpoint.
- **Touch targets** are generally adequate, but some interactive elements lack focus states (see Accessibility).

---

## 6. Performance Findings

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| Medium | `app/(dashboard)/page.tsx` | 76–95 | Loads unbounded counts and recent runs without pagination | Add `limit` and use head-only `count` |
| Medium | `app/(dashboard)/playlists/page.tsx` | 341–346, 356 | Loads up to 200 playlists plus 3 tracks each | Paginate or virtualize; load tracks on demand |
| Medium | `app/(dashboard)/tracks/page.tsx` | 87 | Defaults to 500 tracks, capped at 1000 | Lower cap and paginate |
| Medium | `app/(dashboard)/feed/page.tsx` | 149–161, 187–215 | Polls `agent_runs` every 3 seconds | Use Supabase realtime channel or backoff polling |
| Low | `app/(dashboard)/playlists/page.tsx` | 1–673 | Large single-file component (673 lines) | Split into smaller components (`PlaylistCard`, `PlaylistFilters`, `PlaylistImportModal`) |
| Low | `components/AuroraBackground.tsx` | 1–12 | CSS-only background, but `globals.css` has heavy keyframe animations | Verify reduced-motion support |

---

## 7. Re-render / Memoization Issues

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| Medium | `app/(dashboard)/playlists/page.tsx` | 341–346 | `setPlaylists` and derived state recalculated on every filter change | Memoize filtered list with `useMemo` |
| Medium | `app/(dashboard)/feed/page.tsx` | 149–161 | Polling state updates cause whole page re-render | Isolate polling into a small sub-component |
| Low | `components/FilterPill.tsx` | 1–23 | Simple component, but parent passes inline callbacks | Wrap callbacks in `useCallback` or make component pure |
| Low | `components/StarRating.tsx` | 1–58 | Re-renders on every hover state | Memoize star buttons with `React.memo` |

---

## 8. Accessibility Findings

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| Medium | `components/StarRating.tsx` | 31–53 | Star buttons have no `aria-label` | Add `aria-label={`Rate ${idx} stars`}` |
| Medium | `components/FilterPill.tsx` | 9–22 | Toggle button lacks `aria-pressed` | Add `aria-pressed={active}` |
| Medium | `components/BottomNav.tsx` | 26–37 | Active tab lacks `aria-current="page"` | Add `aria-current={active ? 'page' : undefined}` |
| Medium | `components/nav.tsx` | 57–69 | Nav links lack `aria-current` | Add `aria-current` to active link |
| High | `components/MobileHeader.tsx` | 41–46, 49–86 | Hamburger button has no `aria-label`; profile sheet lacks `role="dialog"`/focus trap | Add `aria-label="Open profile"`, `role="dialog"`, and focus management |
| Low | `app/(dashboard)/ratings/page.tsx` | 132–137 | Table headers have no `scope="col"` | Add `scope="col"` to `<th>` |
| Low | `app/(dashboard)/playlists/page.tsx` | 583–590 | Toast messages have no `role="status"` | Wrap in `<div role="status" aria-live="polite">` |
| Medium | `app/gian-lucca/page.tsx` | 78–89, 184–191, 215–219 | Videos/audio lack captions/transcripts | Provide captions or transcripts |
| Low | `app/(auth)/login/page.tsx` | 91–112 | Show-password button lacks `aria-label` | Add `aria-label={showPassword ? 'Hide password' : 'Show password'}` |

---

## 9. Security-Relevant Frontend Issues

| Severity | File | Line(s) | Issue | Fix |
|----------|------|---------|-------|-----|
| Critical | `app/(auth)/login/page.tsx` | 10–12 | Hardcoded test-account email/password shipped in source | Remove credentials; use seeded DB accounts or env vars |
| Medium | `app/(dashboard)/feed/page.tsx` | 90–99 | `item.url` from DB used directly as `href`; malicious `javascript:` URL would execute | Validate/normalize URLs server-side; reject non-http(s) schemes |
| Medium | `app/(dashboard)/playlists/page.tsx` | 110–118 | `external_id` used to construct `href` without validation | Validate `external_id` format before constructing URL |
| Medium | `app/(dashboard)/playlists/[id]/page.tsx` | 209–216 | Same `external_id`-based `href` concern | Validate `external_id` format |

---

## 10. Recommendations Summary

1. Split large page components into smaller, memoized components.
2. Introduce React Query or SWR for server-state caching and polling management.
3. Add `React.memo`, `useMemo`, and `useCallback` in filter-heavy components.
4. Fix all ARIA labels, roles, and focus management issues.
5. Remove hardcoded credentials from the login page.
6. Add pagination and lower default limits on all list endpoints.
7. Respect `prefers-reduced-motion` for the aurora animation.
