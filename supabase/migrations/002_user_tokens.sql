-- Per-user OAuth tokens for Spotify / Tidal (stored server-side via dashboard OAuth flow)
CREATE TABLE IF NOT EXISTS user_tokens (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service       text        NOT NULL CHECK (service IN ('spotify', 'tidal')),
  access_token  text        NOT NULL,
  refresh_token text,
  expires_at    timestamptz NOT NULL,
  service_user_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service)
);

ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own tokens
DROP POLICY IF EXISTS "user_tokens_select" ON user_tokens;
CREATE POLICY "user_tokens_select" ON user_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_tokens_insert" ON user_tokens;
CREATE POLICY "user_tokens_insert" ON user_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_tokens_update" ON user_tokens;
CREATE POLICY "user_tokens_update" ON user_tokens
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_tokens_delete" ON user_tokens;
CREATE POLICY "user_tokens_delete" ON user_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());
