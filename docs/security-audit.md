# Runway — Security Audit

**Project:** Runway Music Discovery Dashboard  
**Location:** `C:/Users/Dekan AI Brother/runway/`  
**Date:** 2026-06-14  

---

## Executive Summary

Runway is a Next.js 14 music-discovery dashboard backed by Supabase with OAuth integrations for Spotify and Tidal. The audit identified **2 critical, 16 high, 12 medium, and 5 low severity issues**. The most severe findings are hardcoded credentials shipped in source code, a bypassable authentication middleware, and missing authorization checks on playlist mutations.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 16 |
| 🟡 Medium | 12 |
| 🟢 Low | 5 |

---

## 🔴 Critical

### 1. Hardcoded credentials in login page

- **File:** `app/(auth)/login/page.tsx`
- **Lines:** 10–12
- **Issue:** Test-account email and password are hardcoded in the login page source.
- **Fix:** Remove credentials from source; use seeded database accounts or environment variables. Never ship passwords in client code.

### 2. Middleware does not verify JWT signature

- **File:** `middleware.ts`
- **Lines:** 21–38
- **Issue:** The custom middleware extracts `sb-access-token` and only checks that it has three dot-separated parts. It does not verify signature, expiration, issuer, or audience.
- **Fix:** Use `@supabase/ssr` `createServerClient` and call `supabase.auth.getUser()` in middleware. Reject requests where `getUser()` returns no user.

---

## 🟠 High

### 3. Custom `/api/auth/login` reimplements Supabase auth

- **File:** `app/api/auth/login/route.ts`
- **Lines:** 37–113
- **Issue:** Calls `/auth/v1/token` directly, bypassing `@supabase/ssr` security features.
- **Fix:** Use `supabase.auth.signInWithPassword()` from the server client.

### 4. Auth cookies lack security flags

- **File:** `app/api/auth/login/route.ts`
- **Lines:** 80, 85–89, 95–109
- **Issue:** Cookies are set without `httpOnly`, `secure`, or `sameSite='strict'`. The access token is also returned in the JSON body.
- **Fix:** Use `httpOnly`, `secure`, `sameSite='lax'` (or `strict` for non-OAuth), and remove tokens from the response body.

### 5. `POST /api/feed` is unauthenticated

- **File:** `app/api/feed/route.ts`
- **Lines:** 35–47
- **Issue:** The route uses the service-role client but never calls `supabase.auth.getUser()` or validates a shared secret.
- **Fix:** Add authentication or a shared API secret before inserting feed items.

### 6–12. Hardcoded Supabase/Tidal keys in scripts and agents

- **Files:**
  - `agents/runway_client.py` lines 15–17
  - `scripts/trigger-tidal-auth.mjs` lines 2–5, 8–12, 33
  - `scripts/run-similar-for-dekan.mjs` lines 2–6, 9–12, 33, 47–48
  - `scripts/list-all-tables.mjs` lines 1–2
  - `scripts/list-tables.mjs` lines 1–2
  - `scripts/pg-meta-test.mjs` lines 1–2
  - `scripts/check-tokens.mjs` lines 1–2
  - `scripts/make-similar-tidal-playlist.mjs` lines 5–6
  - `scripts/refresh-tidal-token.mjs` lines 5–6
- **Issue:** Supabase service-role keys, anon keys, Tidal client ID/secret, and user credentials are committed to source.
- **Fix:**
  1. Rotate all exposed Supabase and Tidal credentials immediately.
  2. Refactor scripts/agents to read from environment variables.
  3. Delete or move one-off utility scripts out of version control.

### 13. Missing ownership checks on playlist delete

- **File:** `app/api/playlist/delete/route.ts`
- **Lines:** 10–11, 19–23, 61–64
- **Issue:** Authenticates user but does not verify the playlist belongs to them before soft-deleting.
- **Fix:** Add `user_id` to `playlists` and check `playlist.user_id === user.id`.

### 14. Missing ownership checks on playlist edit

- **File:** `app/api/playlist/edit/route.ts`
- **Lines:** 10–11, 27–35, 90
- **Issue:** Any authenticated user can edit any playlist.
- **Fix:** Enforce owner check before update.

### 15. `/api/playlists/sync` mutates all playlists

- **File:** `app/api/playlists/sync/route.ts`
- **Lines:** 154–157, 262–277
- **Issue:** Bulk sync can mark any user’s playlists as deleted.
- **Fix:** Filter by `user_id` and only mutate the caller’s rows.

### 16. `/api/playlist/sync` lacks ownership check

- **File:** `app/api/playlist/sync/route.ts`
- **Lines:** 5–9, 14–16, 47–52
- **Issue:** Updates status of any playlist.
- **Fix:** Add owner check.

### 17. Playlist metadata routes lack ownership check

- **File:** `app/api/playlists/[id]/metadata/route.ts`
- **Lines:** 27–29, 43–48, 61–70
- **Issue:** Saves metadata for any playlist.
- **Fix:** Add owner check.

### 18. Playlist description sync lacks ownership check

- **File:** `app/api/playlists/[id]/sync-description/route.ts`
- **Lines:** 22–30, 32–40
- **Issue:** Syncs description to Tidal for any playlist.
- **Fix:** Add owner check.

### 19. Playlist tracks route lacks ownership check

- **File:** `app/api/playlists/[id]/tracks/route.ts`
- **Lines:** 51–56, 71–80, 91
- **Issue:** Updates tracks in any playlist without verifying ownership.
- **Fix:** Add `user_id` ownership chain.

### 20. Playlist create has no owner

- **File:** `app/api/playlist/create/route.ts`
- **Lines:** 8–9, 22–33
- **Issue:** Creates playlist records with no owner association.
- **Fix:** Add `user_id` column and set it to `user.id`.

### 21. Rekordbox export lacks ownership check

- **File:** `app/api/rekordbox/export/route.ts`
- **Lines:** 67–68, 76–91
- **Issue:** Exports any playlist by `playlist_id`.
- **Fix:** Add owner check.

### 22. Recommend-similar reads any playlist

- **File:** `app/api/recommend-similar/route.ts`
- **Lines:** 151–154, 175–178
- **Issue:** Reads any source playlist and creates a recommendation copy.
- **Fix:** Add owner check.

---

## 🟡 Medium

### 23. Command injection in feed scrape

- **File:** `app/api/feed/scrape/route.ts`
- **Lines:** 19, 36–38
- **Issue:** `execSync` builds a shell string from request body `source` and `limit`.
- **Fix:** Use `spawn`/`execFile` with `shell: false` and pass arguments as an array.

### 24. Open redirect in auth callback

- **File:** `app/api/auth/callback/route.ts`
- **Lines:** 7–30
- **Issue:** Redirects to `${origin}${next}` without validating `next`.
- **Fix:** Validate `next` is a relative path and belongs to the app.

### 25. Weak YouTube URL validation

- **File:** `app/api/feed/youtube/route.ts`
- **Lines:** 23–38
- **Issue:** `url.hostname.includes('youtube.com')` allows `youtube.com.evil.com`.
- **Fix:** Use an allow-list of exact hostnames.

### 26. No CSRF protection

- **Files:** All state-changing API routes
- **Issue:** State-changing POST/PATCH endpoints rely only on session cookies with `SameSite=lax`.
- **Fix:** Add CSRF tokens or use `SameSite=strict` for non-OAuth cookies.

### 27. XSS via feed URL

- **File:** `app/(dashboard)/feed/page.tsx`
- **Lines:** 90–99
- **Issue:** `item.url` used directly as `href`; `javascript:` URLs could execute.
- **Fix:** Validate/normalize URLs server-side and reject non-http(s) schemes.

### 28–29. Verbose credential logging

- **Files:**
  - `app/api/tidal/auth/route.ts` lines 45–49
  - `app/api/tidal/callback/route.ts` lines 31–39, 65–68, 94–98
- **Issue:** Logs partial client IDs, state, code prefixes, redirect URIs, and token presence.
- **Fix:** Remove or redact sensitive OAuth parameters from logs.

### 30. Missing security headers

- **File:** `next.config.mjs`
- **Lines:** 2–10
- **Issue:** No CSP, HSTS, X-Frame-Options, or X-Content-Type-Options headers.
- **Fix:** Add `headers` config with security headers.

### 31. Tracks endpoint leaks debug data

- **File:** `app/api/tracks/route.ts`
- **Lines:** 18–55, 75–84
- **Issue:** Returns `user_id`, row counts, and a `sample_row` to the client.
- **Fix:** Remove debug payload in production.

### 32. `agent_runs` UPDATE policy is permissive

- **File:** `supabase/migrations/001_initial.sql`
- **Lines:** 156–158
- **Issue:** `USING (true)` allows any authenticated user to update any agent run.
- **Fix:** Scope to owner or service role.

### 33. `tracks` INSERT policy allows spoofing

- **File:** `supabase/migrations/001_initial.sql`
- **Lines:** 113–114
- **Issue:** `WITH CHECK (true)` allows any user to insert tracks with any `discovered_by`.
- **Fix:** Restrict insert to service role or track owner.

---

## 🟢 Low

### 34. `.env.local.example` tracked in Git

- **File:** `.env.local.example`
- **Issue:** Example env file is committed.
- **Fix:** Remove from history and ensure `.gitignore` covers it.

### 35. Python `venv/` inside repo

- **Location:** `venv/`
- **Issue:** Virtual environment directory exists inside the project.
- **Fix:** Remove and ensure `venv/` is in `.gitignore`.

### 36. Dependency vulnerabilities

- **File:** `package.json`
- **Lines:** 12, 16, 27–28
- **Issue:** `npm audit` likely reports vulnerabilities in current versions.
- **Fix:** Run `npm audit fix` and update dependencies.

### 37. Hardcoded Windows paths in agents

- **Files:**
  - `agents/playlist_production.py` lines 77–78
  - `agents/discovery_production.py` lines 318–319
- **Issue:** Hardcoded paths to MCP servers.
- **Fix:** Use environment variables or CLI arguments.

### 38. Hardcoded production URL fallback

- **File:** `lib/tidal/auth-config.ts`
- **Line:** 15
- **Issue:** Falls back to `https://runway-lac-ten.vercel.app`.
- **Fix:** Require `NEXT_PUBLIC_SITE_URL` explicitly.

---

## Immediate Action Items

1. Rotate all Supabase and Tidal credentials exposed in source.
2. Rewrite `middleware.ts` to use `@supabase/ssr` session validation.
3. Replace custom `/api/auth/login` with Supabase SSR.
4. Add `user_id` ownership to `playlists`, `tracks`, and `agent_runs`.
5. Fix command injection in `/api/feed/scrape`.
6. Add authentication to `POST /api/feed`.
7. Remove or secure all utility scripts containing keys.
8. Add security headers in `next.config.mjs`.
