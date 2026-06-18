# Runway — Security Review: LLM Integration & Current Posture

**Reviewer:** Security_Reviewer (Orchestrator sub-agent)  
**Date:** 2026-06-18  
**Scope:** Security posture for adding OpenRouter / Kimi LLM API; general security gaps  
**Files analyzed:** `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `next.config.mjs`, `package.json`, all API routes under `app/api/`, Python agents (`runway_client.py`, `discovery.py`, `discovery_production.py`, `smart_discovery.py`, `playlist.py`), Supabase migrations (`001_initial.sql`, `002_user_tokens.sql`, `008_playlist_ownership.sql`), `docs/security-audit.md`, `CRITICAL_PATH_FIXES.md`, `.env.local.example`, `scripts/*.mjs`.

---

## 1. Current Security Assessment

**Score: 5 / 10**

> *Many critical fixes from the June 14 audit have been applied, but several high-severity gaps remain — including a broken critical path in playlist creation and missing ownership columns.*

### What has been fixed since the June 14 audit (positive)

| Fix | Evidence in current code |
|-----|--------------------------|
| ✅ Middleware now uses `@supabase/ssr` `createServerClient` + `getUser()` | `middleware.ts` lines 50–84 |
| ✅ Security headers added (CSP, X-Frame-Options, etc.) | `next.config.mjs` lines 9–47 |
| ✅ CSRF double-submit cookie protection | `middleware.ts` lines 32–47, `lib/csrf.ts` |
| ✅ Auth callback open redirect fixed | `app/api/auth/callback/route.ts` lines 35–37 (`isRelativePath`) |
| ✅ Login route uses `supabase.auth.signInWithPassword()` | `app/api/auth/login/route.ts` line 55 |
| ✅ Tidal cookie security (`httpOnly`, `secure`, `SameSite`) | `lib/tidal/auth-config.ts` lines 26–32 |
| ✅ Scripts refactored to read env vars | `scripts/check-tokens.mjs`, `scripts/list-tables.mjs` lines 1–2 |
| ✅ `agents/runway_client.py` reads from env vars via `_require_env()` | `agents/runway_client.py` lines 14–28 |
| ✅ Playlist ownership migration added (`user_id` + tightened RLS) | `supabase/migrations/008_playlist_ownership.sql` |
| ✅ `POST /api/feed` now requires auth or shared secret | `app/api/feed/route.ts` lines 40–47 |
| ✅ Tracks API no longer leaks debug payload | `app/api/tracks/route.ts` lines 48–52 |

### What is still broken or missing (negative)

| Issue | Severity | Evidence |
|-------|----------|----------|
| 🔴 `run-prompt` and `discover` routes insert playlists **without `user_id`** | **Critical** | `app/api/run-prompt/route.ts` lines 146–157; `app/api/discover/route.ts` lines 115–126. Migration 008 made `user_id NOT NULL` on `playlists`. These routes will **500** on every playlist insert. |
| 🔴 `tracks` table still lacks `user_id` | **Critical** | `001_initial.sql` lines 17–27; `008_playlist_ownership.sql` only tightens insert/update to `false` for authenticated users but never adds a column. No ownership chain possible. |
| 🔴 `agent_runs` table still lacks `user_id` | **Critical** | Same as above. Routes insert agent runs without owner. |
| 🟠 `user_tokens` stores OAuth tokens in **plaintext** | **High** | `002_user_tokens.sql` line 6: `access_token text NOT NULL`. No application-level encryption. Supabase encrypts at rest, but a compromised service key exposes all user tokens. |
| 🟠 Missing `Strict-Transport-Security` (HSTS) header | **High** | `next.config.mjs` has CSP, X-Frame-Options, etc., but **no HSTS**. On Vercel this is partially mitigated by platform HSTS, but explicit config is safer. |
| 🟠 No API rate limiting anywhere | **High** | No Redis / KV / middleware rate limiting. LLM API routes (once added) would be especially vulnerable to cost blowouts. |
| 🟠 `tracks` SELECT RLS is still `USING (true)` | **Medium** | `001_initial.sql` line 110; not tightened in 008. Any authenticated user can read every track. |
| 🟠 `agent_runs` SELECT RLS is still `USING (true)` | **Medium** | `001_initial.sql` line 151; not tightened in 008. Any authenticated user can read every run. |
| 🟡 Hardcoded Windows paths in Python agents | **Medium** | `agents/discovery_production.py` lines 321, 325; `agents/smart_discovery.py` lines 279–280. Defaults fallback to `C:\Users\Dekan AI Brother\...`. Acceptable if env vars are set, but fragile. |
| 🟡 `package.json` has no `npm audit` / `dependabot` automation | **Low** | `next` 14.2.5 may have known vulnerabilities. |

---

## 2. Key Findings (Prioritized)

### 🔴 CRITICAL-1: `run-prompt` and `discover` routes are broken due to missing `user_id`

**Files:**
- `app/api/run-prompt/route.ts` lines 146–157
- `app/api/discover/route.ts` lines 115–126

**Issue:** After migration 008 (`ALTER TABLE playlists ALTER COLUMN user_id SET NOT NULL`), these routes still insert playlists without `user_id`. Because the insert uses the service-role client (which bypasses RLS but **not** `NOT NULL` constraints), every call will trigger a PostgreSQL `not-null violation` and return HTTP 500.

**Fix (immediate):**
```ts
// In run-prompt and discover, after supabase.auth.getUser() returns user:
await supabase.from('playlists').insert({
  name: created.name,
  agent,
  service,
  external_id: created.id,
  track_count: created.track_count,
  prompt_name: promptName,
  user_id: user.id, // ← ADD THIS
})
```

Also add `user_id` to `agent_runs` inserts in the same files.

---

### 🔴 CRITICAL-2: `tracks` and `agent_runs` tables lack `user_id` columns

**Files:** `supabase/migrations/001_initial.sql`, `supabase/migrations/008_playlist_ownership.sql`

**Issue:** Migration 008 only added `user_id` to `playlists`. It did **not** add ownership columns to `tracks` or `agent_runs`, despite `CRITICAL_PATH_FIXES.md` recommending it. This means:
- No per-user track isolation (anyone can read all tracks via RLS `USING (true)`).
- No per-user run isolation.
- API routes cannot enforce ownership on these tables.

**Fix:**
```sql
-- Migration 009 (or append to 008)
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Backfill to earliest user (or a sentinel service-user UUID)
UPDATE tracks SET user_id = (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
) WHERE user_id IS NULL;
UPDATE agent_runs SET user_id = (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
) WHERE user_id IS NULL;

-- Then tighten RLS
CREATE POLICY "tracks_select_own" ON tracks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agent_runs_select_own" ON agent_runs FOR SELECT TO authenticated USING (user_id = auth.uid());
```

---

### 🟠 HIGH-1: OAuth tokens stored in plaintext

**File:** `supabase/migrations/002_user_tokens.sql` line 6

**Issue:** `access_token` and `refresh_token` are stored as plain `text`. If the service-role key is ever exposed (e.g., via a script leak, log leak, or SSRF), an attacker can read every user's Spotify/Tidal tokens and act on their behalf.

**Fix:**
1. Add an application-level encryption layer (e.g., Fernet / AES-256-GCM) in Python agents and Next.js API routes.
2. Store a `ENCRYPTION_KEY` env var (server-only).
3. Encrypt before `upsert`, decrypt after `select`.

**Short-term workaround:** At minimum, ensure `user_tokens` is never selected in API routes except via `eq('user_id', user.id)` and service-role upserts are restricted to callback routes only.

---

### 🟠 HIGH-2: No rate limiting

**Issue:** Every API route is unprotected from burst requests. Once an LLM API is added, a single malicious or buggy loop could rack up thousands of dollars in LLM costs.

**Fix:**
- Use **Vercel KV** or **Upstash Redis** for a lightweight token-bucket rate limiter.
- Apply per-user + per-IP limits:
  - General API: 60 requests / minute per user
  - LLM API: 10 requests / minute per user, 100 / minute global
- Implement a **circuit breaker** for LLM failures (3 consecutive 5xx → 30s cooldown).

---

### 🟠 HIGH-3: Missing HSTS header

**File:** `next.config.mjs` lines 9–47

**Issue:** No `Strict-Transport-Security` header. On Vercel, platform-level HSTS may apply, but explicit configuration is defense-in-depth.

**Fix:**
```js
{
  key: 'Strict-Transport-Security',
  value: 'max-age=63072000; includeSubDomains; preload',
}
```

---

### 🟡 MEDIUM-1: `tracks` and `agent_runs` RLS SELECT policies are still permissive

**Issue:** `USING (true)` allows any authenticated user to read all tracks and all agent runs. In a multi-user dashboard this leaks cross-user data.

**Fix:** Tighten to `user_id = auth.uid()` after adding the columns (see CRITICAL-2).

---

## 3. LLM Integration Security Recommendations

> **Important discovery:** The codebase currently has **no actual LLM API integration**. The `Agent` type (`'KIMI' | 'CLAUDE'`) is purely a **cosmetic label** for the music-discovery pipeline. The actual discovery happens via local MCP stdio clients (`agents/discovery.py`) that talk to Spotify/Tidal MCP servers. Therefore, adding an LLM API is a **new capability**, not a replacement of existing broken code.

### 3.1 Where the new API keys should live

| Key | Location | Visibility |
|-----|----------|------------|
| `OPENROUTER_API_KEY` | `.env.local` (server-only) | Never expose to client. Do **not** prefix with `NEXT_PUBLIC_`. |
| `KIMI_API_KEY` | `.env.local` (server-only) | Same as above. |
| `LLM_MAX_REQUESTS_PER_MINUTE` | `.env.local` (server-only) | Rate-limit config. |
| `LLM_REQUEST_TIMEOUT_MS` | `.env.local` (server-only) | Default 30,000 ms. |
| `LLM_ENCRYPTION_KEY` | `.env.local` (server-only) | Optional: encrypt any LLM-persisted prompts / results. |

### 3.2 Server-side utility only

**Create one of these — never both:**

- **TypeScript path:** `lib/llm.ts` (imported only by `app/api/*` route handlers)
- **Python path:** `agents/llm_client.py` (imported only by CLI agents or Python API workers)

**Guard against accidental client-side import:**

Add a build-time safety assertion in `lib/llm.ts`:
```ts
import 'server-only'
if (typeof window !== 'undefined') {
  throw new Error('lib/llm.ts must never be imported in client code')
}
```

And add an ESLint rule or a simple CI check:
```bash
# CI check
if grep -r "lib/llm" app/\(auth\)/ app/\(dashboard\)/ components/; then
  echo "ERROR: lib/llm imported in client code"
  exit 1
fi
```

### 3.3 Rate limiting for LLM calls

Implement a token-bucket middleware or wrapper:

```ts
// lib/rate-limit.ts
import { kv } from '@vercel/kv' // or Upstash

export async function checkLlmRateLimit(userId: string): Promise<boolean> {
  const key = `llm:rate:${userId}`
  const limit = parseInt(process.env.LLM_MAX_REQUESTS_PER_MINUTE ?? '10')
  const current = await kv.incr(key)
  if (current === 1) await kv.expire(key, 60)
  return current <= limit
}
```

Use it in every LLM route:
```ts
if (!(await checkLlmRateLimit(user.id))) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

### 3.4 Request timeout and retry logic

```ts
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS ?? '30000')
const MAX_RETRIES = 3

async function callLlmWithRetry(payload: object): Promise<Response> {
  let lastError: Error | undefined
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) return res
      if (res.status >= 500) throw new Error(`Server error ${res.status}`)
      // 4xx = don't retry
      return res
    } catch (err) {
      lastError = err as Error
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i))) // exponential backoff
    }
  }
  throw new Error(`LLM request failed after ${MAX_RETRIES} retries: ${lastError?.message}`)
}
```

### 3.5 Input sanitization before sending to LLM

```ts
function sanitizePrompt(input: string): string {
  const maxLength = 4000
  let cleaned = input.trim()
  // Strip potential prompt-injection patterns
  cleaned = cleaned.replace(/(system|assistant|user)/gi, '')
  // Truncate
  if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength) + '...'
  return cleaned
}
```

Also reject suspicious content:
- `javascript:` or `data:` URLs in any prompt
- Excessive repetition (>50% of tokens repeated)
- PII patterns (emails, SSNs) — optional but recommended

### 3.6 Logging and error handling

- **Never log the API key.** Redact `Authorization` headers before logging.
- Log: `user_id`, `prompt_length`, `model_name`, `latency_ms`, `status_code`, `tokens_used`.
- On failure, return generic `500` to client; log detailed error server-side.

---

## 4. General Security Recommendations (Unrelated to LLM)

### 4.1 Fix the broken playlist insert routes immediately

Apply `user_id: user.id` to `app/api/run-prompt/route.ts` and `app/api/discover/route.ts` playlist inserts. Also add `user_id` to `agent_runs` inserts in those files.

### 4.2 Add `user_id` to `tracks` and `agent_runs` tables

Create migration `009_ownership_completion.sql` with the SQL from CRITICAL-2 above. Update `run-prompt`, `discover`, and `recommend-similar` to set `user_id` on track inserts.

### 4.3 Encrypt `user_tokens` application-side

Add a `crypto.ts` / `crypto.py` helper that encrypts/decrypts tokens with `ENCRYPTION_KEY` before DB persistence.

### 4.4 Add API-level rate limiting (non-LLM)

Even without LLM, the `run-prompt` and `discover` routes trigger external API calls to Spotify/Tidal. A malicious user could abuse these to hit rate limits or cause account flags.

Recommended limits:
- `run-prompt`: 5 / minute per user
- `discover`: 10 / minute per user
- `recommend-similar`: 3 / minute per user

### 4.5 Add `Strict-Transport-Security` header

See HIGH-3 above.

### 4.6 Run `npm audit` and update dependencies

```bash
npm audit fix
npm update next react react-dom
```

`next` 14.2.5 should be checked for known CVEs.

### 4.7 Remove or `.gitignore` utility scripts with key access

Scripts like `check-tokens.mjs`, `list-tables.mjs`, `pg-meta-test.mjs` are useful for local debugging but carry service-role access. Consider:
- Moving them to a private `scripts/` repo or `runway-scripts` repo
- Adding a `.gitignore` rule: `scripts/internal/*`
- Or at minimum, adding a warning header comment in each file

### 4.8 Add a `SECURITY.md` file

Document the secret rotation policy, incident response steps, and who to contact. This is standard practice for open-source or team projects.

---

## 5. Recommended `.env.local.example` Update

Here is the recommended `.env.local.example` reflecting the new LLM keys and related config values:

```bash
# ─── Supabase (Next.js client) ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# ─── Supabase (server / agents / scripts) ─────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ─── Site URL (OAuth callbacks) ─────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app

# ─── Tidal OAuth ────────────────────────────────────────────────────────────
TIDAL_CLIENT_ID=your_tidal_client_id
TIDAL_CLIENT_SECRET=your_tidal_client_secret

# ─── Spotify OAuth / MCP ──────────────────────────────────────────────────────
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_MCP_CMD=node
SPOTIFY_MCP_CWD=/absolute/path/to/spotify-mcp-server

# ─── Tidal MCP ────────────────────────────────────────────────────────────────
TIDAL_MCP_CMD=node
TIDAL_MCP_CWD=/absolute/path/to/tidal-mcp-server

# ─── Feed ingestion shared secret (server-to-server) ─────────────────────────
FEED_INGEST_SECRET=your_random_secret_here

# ─── LLM API Keys (SERVER-ONLY — never prefix with NEXT_PUBLIC_) ─────────────
# Choose one provider. OpenRouter is recommended for model flexibility.
OPENROUTER_API_KEY=your_openrouter_key_here
KIMI_API_KEY=your_kimi_key_here

# ─── LLM safety / rate-limit config ───────────────────────────────────────────
LLM_MAX_REQUESTS_PER_MINUTE=10
LLM_REQUEST_TIMEOUT_MS=30000
LLM_MAX_RETRIES=3

# ─── Application-level encryption for tokens (optional but recommended) ───────────
ENCRYPTION_KEY=your_32_byte_base64_key_here
```

### Important notes on `.env.local.example`:

1. **Never** add `NEXT_PUBLIC_OPENROUTER_API_KEY` or any client-exposed variant. The key must remain server-side only.
2. **Rotate immediately** if any `.env.local` file is accidentally committed. Use `git filter-repo` or BFG to scrub history.
3. Add `.env.local` and `.env*.local` to `.gitignore` if not already present.

---

## 6. Action Checklist (Ordered by Priority)

| # | Action | Severity | Effort | Owner |
|---|--------|----------|--------|-------|
| 1 | Fix `user_id` missing in `run-prompt` and `discover` playlist inserts | 🔴 Critical | 15 min | Backend |
| 2 | Add `user_id` columns to `tracks` + `agent_runs` + tighten RLS | 🔴 Critical | 2 hrs | DB / Backend |
| 3 | Add `user_id` to all `agent_runs` inserts in API routes | 🔴 Critical | 15 min | Backend |
| 4 | Add application-level encryption for `user_tokens` | 🟠 High | 3 hrs | Backend |
| 5 | Add HSTS to `next.config.mjs` | 🟠 High | 5 min | DevOps |
| 6 | Implement rate limiting (Vercel KV / Upstash) for all API routes | 🟠 High | 4 hrs | Backend |
| 7 | Add `server-only` guard + CI check for `lib/llm.ts` | 🟠 High | 30 min | Backend |
| 8 | Write `lib/llm.ts` with timeout, retry, sanitize, and circuit breaker | 🟡 Medium | 4 hrs | Backend |
| 9 | Update `.env.local.example` with new LLM keys | 🟡 Medium | 5 min | DevOps |
| 10 | Run `npm audit fix` and update `next` | 🟡 Medium | 30 min | DevOps |
| 11 | Move sensitive utility scripts out of repo or add warnings | 🟢 Low | 1 hr | DevOps |
| 12 | Write `SECURITY.md` incident response doc | 🟢 Low | 1 hr | Security |

---

## 7. Summary for the Parent Agent

**Bottom line:** The Runway project has made significant security improvements since the June 14 audit (middleware, headers, CSRF, auth routes, env-var hygiene, playlist ownership). However, **two critical bugs currently break the app**: `run-prompt` and `discover` routes fail to insert playlists because `user_id` is missing after migration 008. Additionally, `tracks` and `agent_runs` still lack ownership columns, preventing full multi-user security.

For the **new LLM integration**, the safest approach is:
1. Store keys as **server-only** env vars (`OPENROUTER_API_KEY`, `KIMI_API_KEY`).
2. Create a **single server-side utility** (`lib/llm.ts` or `agents/llm_client.py`) with `import 'server-only'`.
3. Add **rate limiting** (10 req/min per user), **request timeouts** (30s), **exponential backoff retries** (max 3), and **input sanitization** before sending prompts.
4. Add a **circuit breaker** to prevent cascading failures and cost blowouts.
5. **Never log the API key**; log only metadata (user_id, latency, status, token usage).

**Estimated time to bring the project to a 7/10 security score:** 2–3 days (fixing critical ownership gaps + adding rate limiting + LLM utility).

**Estimated time to bring the project to a 9/10 security score:** 1 week (adding token encryption, full RLS tightening, HSTS, dependency updates, CI checks, and documentation).
