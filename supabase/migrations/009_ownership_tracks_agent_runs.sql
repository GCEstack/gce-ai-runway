-- Add user ownership to tracks and agent_runs and tighten RLS policies.
-- Run after 008_playlist_ownership.sql.

-- ─── TRACKS ──────────────────────────────────────────────────────────────────
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Backfill existing tracks to the earliest-created auth user.
-- For a single-user app this is usually correct; if you have multiple users,
-- run a targeted UPDATE first, then re-run this migration.
UPDATE tracks
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

-- Require ownership going forward.
ALTER TABLE tracks
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);

-- ─── AGENT RUNS ──────────────────────────────────────────────────────────────
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

UPDATE agent_runs
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

ALTER TABLE agent_runs
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);

-- ─── RLS POLICIES ────────────────────────────────────────────────────────────
-- Tracks are created by service-role agents / API routes. Authenticated users
-- should only see their own tracks.
DROP POLICY IF EXISTS "tracks_select" ON tracks;
CREATE POLICY "tracks_select" ON tracks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tracks_insert" ON tracks;
CREATE POLICY "tracks_insert" ON tracks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tracks_update" ON tracks;
CREATE POLICY "tracks_update" ON tracks
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tracks_delete" ON tracks;
CREATE POLICY "tracks_delete" ON tracks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Agent runs are created/updated by service-role API routes. Authenticated users
-- can read only their own runs.
DROP POLICY IF EXISTS "agent_runs_select" ON agent_runs;
CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;
CREATE POLICY "agent_runs_insert" ON agent_runs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_runs_update" ON agent_runs;
CREATE POLICY "agent_runs_update" ON agent_runs
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
