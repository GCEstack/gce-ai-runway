# Runway — Merge Checklist

Use this checklist before merging and deploying the security fixes and MCP migration.

---

## Pre-merge

- [ ] Rotate all exposed Supabase service-role keys
- [ ] Rotate exposed Supabase anon keys
- [ ] Rotate exposed Tidal client ID and secret
- [ ] Create fresh Spotify client ID and secret (for MCP migration)
- [ ] Backup production Supabase database
- [ ] Export current playlists/tracks/prompts as JSON backup
- [ ] Verify `.env.local` is in `.gitignore` and not tracked
- [ ] Remove or env-var-ize all hardcoded keys in `agents/*.py` and `scripts/*.mjs`
- [ ] Run `npm audit fix` and resolve high/critical dependency issues
- [ ] Normalize line endings in `.gitignore` and `agents/seed_*.py`

---

## Security fixes

- [ ] Rewrite `middleware.ts` to use `@supabase/ssr` `getUser()`
- [ ] Replace custom `app/api/auth/login/route.ts` with Supabase SSR sign-in
- [ ] Add `httpOnly`, `secure`, `sameSite='lax'` to auth cookies
- [ ] Add `user_id` column to `playlists`, `tracks`, and `agent_runs`
- [ ] Add ownership checks to:
  - [ ] `app/api/playlist/delete/route.ts`
  - [ ] `app/api/playlist/edit/route.ts`
  - [ ] `app/api/playlist/sync/route.ts`
  - [ ] `app/api/playlists/sync/route.ts`
  - [ ] `app/api/playlists/[id]/metadata/route.ts`
  - [ ] `app/api/playlists/[id]/sync-description/route.ts`
  - [ ] `app/api/playlists/[id]/tracks/route.ts`
  - [ ] `app/api/rekordbox/export/route.ts`
  - [ ] `app/api/recommend-similar/route.ts`
- [ ] Tighten RLS policies on `playlists`, `tracks`, `agent_runs`
- [ ] Add authentication to `POST /api/feed`
- [ ] Replace `execSync` with `spawn`/`execFile` in `app/api/feed/scrape/route.ts`
- [ ] Add security headers in `next.config.mjs`
- [ ] Remove debug payload from `app/api/tracks/route.ts`
- [ ] Validate redirect `next` param in `app/api/auth/callback/route.ts`
- [ ] Use exact hostname allow-list in `app/api/feed/youtube/route.ts`
- [ ] Remove verbose credential logging in `app/api/tidal/auth/route.ts` and `app/api/tidal/callback/route.ts`

---

## MCP migration

- [ ] Add Spotify OAuth routes:
  - [ ] `app/api/spotify/auth/route.ts`
  - [ ] `app/api/spotify/callback/route.ts`
- [ ] Update `lib/tidal/auth-config.ts` to share OAuth config pattern with Spotify
- [ ] Create `kimi-mcp/tidal/server.json`
- [ ] Create `kimi-mcp/spotify/server.json`
- [ ] Create `kimi-mcp/agent/config.json`
- [ ] Implement `agents/unified_music_agent.py`
- [ ] Refactor `lib/music.ts` to use Unified Music Agent
- [ ] Update `/api/discover`, `/api/run-prompt`, `/api/recommend-similar` to call agent
- [ ] Replace `scripts/agent-runner.mjs` polling with direct agent invocation or queue
- [ ] Add MCP connection status to Settings page
- [ ] Add `.mcp/*.json` to `.gitignore` if they contain local paths

---

## Testing

- [ ] Playlist CRUD: create, read, update, delete as User A; verify User B cannot access
- [ ] Feed scrape: verify only safe argument values execute
- [ ] Auth flow: login, logout, session expiry, middleware redirect
- [ ] Tidal OAuth: connect, refresh token, create playlist
- [ ] Spotify OAuth: connect, create playlist
- [ ] Unified Music Agent: search with fallback, cross-reference playlist
- [ ] Rekordbox export: verify only owner can export
- [ ] Rate limit smoke test: rapid playlist creates
- [ ] Run `npm run build` with no errors
- [ ] Run `npm run lint` with no errors

---

## Deploy

- [ ] Update Vercel environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (new rotated key)
  - [ ] `TIDAL_CLIENT_ID`
  - [ ] `TIDAL_CLIENT_SECRET`
  - [ ] `SPOTIFY_CLIENT_ID`
  - [ ] `SPOTIFY_CLIENT_SECRET`
  - [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] Apply new Supabase migrations in order
- [ ] Deploy to Vercel
- [ ] Smoke test production login
- [ ] Smoke test production Tidal connect
- [ ] Smoke test production playlist creation

---

## Post-merge monitoring

- [ ] Watch Vercel function logs for 24 hours
- [ ] Watch Supabase logs for unauthorized access attempts
- [ ] Verify `agent_runs` are completing successfully
- [ ] Monitor error rates on `/api/feed/scrape`, `/api/run-prompt`, `/api/recommend-similar`
- [ ] Check that no secrets appear in logs
- [ ] Verify RLS policies via `supabase/migrations` test queries
- [ ] Confirm backup retention is working

---

## Rollback plan

If critical issues occur:

1. Re-deploy previous Vercel production deployment.
2. Restore Supabase database from pre-merge backup.
3. Revert to previous service-role key if needed (only if old key was not already revoked).
4. Notify users of any playlist/agent-run data inconsistencies.
