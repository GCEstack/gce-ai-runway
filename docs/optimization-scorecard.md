# Runway — Optimization Scorecard

**Project:** Runway Music Discovery Dashboard  
**Date:** 2026-06-14  

---

## Scorecard

| Subsystem | Score | Justification | Priority Fix |
|-----------|-------|---------------|--------------|
| Frontend Performance | **5/10** | Large page components, no pagination, 3-second polling, missing memoization, no global state/cache | High |
| Backend Scalability | **4/10** | Synchronous `execSync`, one-by-one inserts, no rate limiting, no caching layer | High |
| MCP Integration | **5/10** | Tidal works via dashboard OAuth; Spotify is CLI-only; agents use local subprocesses with hardcoded paths | High |
| Security Posture | **3/10** | Hardcoded keys, bypassable middleware, missing authz, command injection, permissive RLS | Critical |
| Developer Experience | **5/10** | Outdated README, mixed auth patterns, hardcoded paths, no schema validation | Medium |
| Database Design | **6/10** | Reasonable tables and indexes, but missing ownership columns and overly permissive RLS policies | High |
| Music Discovery Pipeline | **6/10** | Functional search/dedup/playlist creation, but inefficient inserts and no fallback between services | Medium |

---

## Subsystem Breakdown

### 1. Frontend Performance — 5/10

**Strengths**
- Tailwind-based responsive UI.
- Server Components used for initial data fetching.
- Component library is small and consistent.

**Weaknesses**
- `app/(dashboard)/playlists/page.tsx` is 673 lines and handles too many concerns.
- Feed page polls `agent_runs` every 3 seconds (`app/(dashboard)/feed/page.tsx` lines 149–161, 187–215).
- Tracks page defaults to 500 rows (`app/(dashboard)/tracks/page.tsx` line 87).
- No `useMemo`/`useCallback` for filtered lists.
- No React Query/SWR for caching.

**Priority fixes**
1. Add pagination and virtualization to playlists/tracks/feed.
2. Replace polling with Supabase realtime subscriptions.
3. Split large pages into smaller components.
4. Add memoization to filter-heavy components.

---

### 2. Backend Scalability — 4/10

**Strengths**
- Stateless serverless API routes.
- External API calls are async.

**Weaknesses**
- `app/api/feed/scrape/route.ts` uses `execSync` and blocks the event loop for up to 120s.
- Tracks are inserted one-by-one in `app/api/discover/route.ts`, `app/api/run-prompt/route.ts`, and `app/api/recommend-similar/route.ts`.
- No Redis/in-memory cache for repeated queries.
- No rate limiting or concurrency controls.

**Priority fixes**
1. Replace `execSync` with async `spawn`.
2. Batch all Supabase inserts.
3. Add a caching layer for Tidal/Spotify metadata.
4. Implement per-user rate limiting.

---

### 3. MCP Integration — 5/10

**Strengths**
- Tidal OAuth flow is complete and stores tokens securely in `user_tokens`.
- Direct REST wrappers exist in `lib/music.ts`.

**Weaknesses**
- Spotify has no dashboard OAuth; only local scripts.
- Agents spawn local subprocesses with hardcoded Windows paths.
- No unified interface for both services.
- Agent runner polls every 5 seconds.

**Priority fixes**
1. Add Spotify OAuth routes.
2. Build `agents/unified_music_agent.py`.
3. Replace subprocess agents with MCP client calls.
4. Move from polling to direct invocation or queue.

---

### 4. Security Posture — 3/10

**Strengths**
- `user_tokens` RLS is correctly scoped.
- `ratings` RLS is correctly scoped.

**Weaknesses**
- Hardcoded Supabase/Tidal/Spotify credentials in scripts and agents.
- Middleware auth bypass.
- Custom login route with insecure cookies.
- Missing ownership checks on playlist mutations.
- Command injection in feed scrape.
- Permissive RLS policies on `playlists`, `tracks`, `agent_runs`.

**Priority fixes**
1. Rotate all exposed credentials.
2. Rewrite middleware and login route.
3. Add `user_id` ownership columns and policies.
4. Fix command injection.
5. Add security headers.

---

### 5. Developer Experience — 5/10

**Strengths**
- TypeScript used throughout.
- Tailwind config is well-structured.
- Components are reusable.

**Weaknesses**
- README is outdated (only 5 pages and 6 API routes documented).
- Mixed auth patterns (SSR callback, custom login, middleware shape-check).
- No request schema validation (Zod).
- Hardcoded Windows paths and project refs.
- `venv/` inside the Node repo.

**Priority fixes**
1. Update README to match current codebase.
2. Standardize on `@supabase/ssr`.
3. Add Zod validation to all API routes.
4. Move Python agents to their own workspace or repo.

---

### 6. Database Design — 6/10

**Strengths**
- Clear table separation (playlists, tracks, ratings, prompts, feed_items, agent_runs).
- Useful indexes on `discovered_at`, `published_at`, etc.
- Migrations are versioned.

**Weaknesses**
- No ownership columns on `playlists`, `tracks`, or `agent_runs`.
- `agent_runs` UPDATE policy is `USING (true)`.
- `tracks` INSERT policy allows spoofing `discovered_by`.
- `prompts` RLS requires `created_by` but the UI does not send it.

**Priority fixes**
1. Add `user_id` columns to shared tables.
2. Tighten RLS policies.
3. Fix `prompts` insert to include `created_by`.

---

### 7. Music Discovery Pipeline — 6/10

**Strengths**
- Functional end-to-end flow: prompt → search → filter → deduplicate → playlist.
- Cross-service search in `/api/discover`.
- Release-date filtering and deduplication logic exists.

**Weaknesses**
- No fallback when a track exists on one service but not the other.
- One-by-one inserts are inefficient.
- No caching of search results.
- Agent runs are polled, not event-driven.

**Priority fixes**
1. Build unified search with cross-service fallback.
2. Batch inserts.
3. Cache search results with TTL.
4. Use Supabase realtime or webhooks for run status.

---

## Improvement Roadmap

### Phase 1 — Security (Week 1)
- Rotate exposed keys.
- Fix middleware and login route.
- Add ownership columns and policies.
- Fix command injection.

### Phase 2 — Stability (Week 2)
- Add Zod validation to all API routes.
- Standardize auth on `@supabase/ssr`.
- Remove debug endpoints and verbose logging.

### Phase 3 — Performance (Week 3)
- Replace `execSync` with async spawn.
- Batch inserts.
- Add pagination and caching.

### Phase 4 — MCP Migration (Week 4)
- Add Spotify OAuth.
- Build Unified Music Agent.
- Replace subprocess agents with MCP.

### Phase 5 — Polish (Week 5)
- Update README.
- Add tests.
- Run `npm audit fix` and dependency updates.
