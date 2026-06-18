-- Runway Supabase Schema Fix
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';

-- 2. Verify user_id columns exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('tracks', 'agent_runs')
AND column_name = 'user_id';

-- 3. If agent_runs.user_id is missing, add it
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

UPDATE agent_runs
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

ALTER TABLE agent_runs
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);

-- 4. If tracks.user_id is missing, add it
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

UPDATE tracks
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

ALTER TABLE tracks
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);

-- 5. Refresh cache again after changes
NOTIFY pgrst, 'reload schema';
