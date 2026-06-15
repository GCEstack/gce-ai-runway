-- Add user ownership to playlists and tighten related RLS policies.

-- ─── PLAYLISTS ───────────────────────────────────────────────────────────────
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Backfill existing playlists to the earliest-created auth user.
-- For a single-user app this is usually correct; if you have multiple users,
-- run a targeted UPDATE first, then re-run this migration.
UPDATE playlists
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

-- Require ownership going forward.
ALTER TABLE playlists
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);

-- Tighten playlist policies to owner-only.
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

-- ─── TRACKS ──────────────────────────────────────────────────────────────────
-- Tracks are created by service-role agents / API routes. Authenticated users
-- should not insert or update directly; route-level checks enforce ownership.
DROP POLICY IF EXISTS "tracks_insert" ON tracks;
CREATE POLICY "tracks_insert" ON tracks
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "tracks_update" ON tracks;
CREATE POLICY "tracks_update" ON tracks
  FOR UPDATE TO authenticated USING (false);

-- ─── AGENT RUNS ──────────────────────────────────────────────────────────────
-- Agent runs are created/updated by service-role agents. Authenticated users
-- can read but not mutate directly.
DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;
CREATE POLICY "agent_runs_insert" ON agent_runs
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "agent_runs_update" ON agent_runs;
CREATE POLICY "agent_runs_update" ON agent_runs
  FOR UPDATE TO authenticated USING (false);

-- ─── FEED ITEMS ──────────────────────────────────────────────────────────────
-- Feed ingestion is server-to-server via a shared secret. Authenticated users
-- can read but not insert directly.
DROP POLICY IF EXISTS "feed_items_insert" ON feed_items;
CREATE POLICY "feed_items_insert" ON feed_items
  FOR INSERT TO authenticated WITH CHECK (false);
