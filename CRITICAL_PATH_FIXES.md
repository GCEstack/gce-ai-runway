# Runway — Critical Path Fixes

This document extracts the 2 Critical + top 5 High findings from `security-audit.md` and provides ready-to-paste fix snippets.

**DO NOT apply these changes without first rotating exposed secrets and backing up the database.**

---

## 1. Rotate hardcoded Supabase service-role keys

**Severity:** Critical  
**Files affected:**
- `agents/runway_client.py` lines 15–17
- `scripts/check-tokens.mjs` lines 1–2
- `scripts/list-all-tables.mjs` lines 1–2
- `scripts/list-tables.mjs` lines 1–2
- `scripts/pg-meta-test.mjs` lines 1–2
- `scripts/make-similar-tidal-playlist.mjs` lines 5–6
- `scripts/run-similar-for-dekan.mjs` lines 2–6
- `scripts/trigger-tidal-auth.mjs` lines 2–5

**Impact if not fixed:** Anyone with repo access can read/write every row in Supabase, including Spotify/Tidal user tokens.

**Fix steps:**
1. In Supabase Dashboard → Project Settings → API, regenerate `service_role_key`.
2. In Supabase Dashboard → Authentication, regenerate `anon_key` if exposed.
3. In Tidal Developer Portal, regenerate `CLIENT_ID` and `CLIENT_SECRET` if exposed.
4. Update Vercel environment variables with new keys.
5. Refactor files to read from env vars (see snippets below).

### Snippet: `agents/runway_client.py`

```python
import os

DEFAULT_URL = os.environ.get("SUPABASE_URL")
DEFAULT_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
DEFAULT_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not DEFAULT_URL or not DEFAULT_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
```

### Snippet: `scripts/*.mjs`

```js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
```

**Estimated time:** 2–3 hours (plus key rotation and re-deployment).

---

## 2. Fix middleware.ts JWT validation bypass

**Severity:** Critical  
**File:** `middleware.ts` lines 21–38

**Impact if not fixed:** Anyone can craft a JWT-shaped cookie and bypass authentication for all protected routes.

**Fix snippet:**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const publicPaths = ['/login', '/_next', '/api/auth', '/gian-lucca']
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  const cookieStore = request.cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // middleware cannot set cookies; let route handlers refresh session
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

**Estimated time:** 1 hour.

---

## 3. Fix custom /api/auth/login cookie security

**Severity:** High  
**File:** `app/api/auth/login/route.ts` lines 37–113

**Impact if not fixed:** Session cookies are vulnerable to XSS theft; access token is exposed in JSON response.

**Fix snippet:**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? 'Login failed' }, { status: 401 })
  }

  return NextResponse.json({ user: data.user })
}
```

**Estimated time:** 1–2 hours.

---

## 4. Add authorization checks to playlist mutations

**Severity:** High  
**Files:**
- `app/api/playlist/delete/route.ts`
- `app/api/playlist/edit/route.ts`
- `app/api/playlist/sync/route.ts`
- `app/api/playlists/sync/route.ts`
- `app/api/playlists/[id]/metadata/route.ts`
- `app/api/playlists/[id]/sync-description/route.ts`
- `app/api/playlists/[id]/tracks/route.ts`
- `app/api/rekordbox/export/route.ts`
- `app/api/recommend-similar/route.ts`

**Impact if not fixed:** Any authenticated user can delete, edit, sync, or export any other user's playlists.

**Required migration:**

```sql
-- Add ownership columns
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
```

**Fix pattern for each route:**

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// When fetching playlist
const { data: playlist } = await supabase
  .from('playlists')
  .select('*')
  .eq('id', id)
  .eq('user_id', user.id)  // <-- scope to owner
  .single()

if (!playlist) {
  return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
}
```

**Estimated time:** 4–6 hours (including migration and updating all callers).

---

## 5. Tighten RLS policies

**Severity:** High  
**File:** `supabase/migrations/001_initial.sql` lines 101–158

**Impact if not fixed:** Authenticated users can read/insert/update rows they do not own across `playlists`, `tracks`, and `agent_runs`.

**Fix migration:**

```sql
-- After adding user_id columns to playlists, tracks, agent_runs

-- playlists
DROP POLICY IF EXISTS "playlists_select" ON playlists;
CREATE POLICY "playlists_select" ON playlists
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "playlists_insert" ON playlists;
CREATE POLICY "playlists_insert" ON playlists
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "playlists_update" ON playlists;
CREATE POLICY "playlists_update" ON playlists
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "playlists_delete" ON playlists;
CREATE POLICY "playlists_delete" ON playlists
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- tracks
DROP POLICY IF EXISTS "tracks_select" ON tracks;
CREATE POLICY "tracks_select" ON tracks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tracks_insert" ON tracks;
CREATE POLICY "tracks_insert" ON tracks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- agent_runs
DROP POLICY IF EXISTS "agent_runs_select" ON agent_runs;
CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;
CREATE POLICY "agent_runs_insert" ON agent_runs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_runs_update" ON agent_runs;
CREATE POLICY "agent_runs_update" ON agent_runs
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
```

**Note:** Service-role API routes must set `user_id` when inserting.

**Estimated time:** 2–3 hours.

---

## Fix Priority Order

1. Rotate secrets (Critical)
2. Fix middleware auth (Critical)
3. Fix login cookie security (High)
4. Add ownership migration + route checks (High)
5. Tighten RLS policies (High)

**Total estimated time:** 2–3 days for a single developer, plus testing and deployment.
