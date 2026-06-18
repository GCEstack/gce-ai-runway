-- Runway: initial schema
-- Run against your Supabase project via Dashboard → SQL Editor

-- ─── PLAYLISTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  agent       text        NOT NULL CHECK (agent IN ('KIMI', 'CLAUDE')),
  service     text        NOT NULL CHECK (service IN ('spotify', 'tidal')),
  external_id text,
  track_count integer     NOT NULL DEFAULT 0,
  prompt_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── TRACKS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text        NOT NULL,
  artist        text        NOT NULL,
  album         text,
  source        text        NOT NULL CHECK (source IN ('spotify', 'tidal')),
  isrc          text,
  discovered_by text        NOT NULL CHECK (discovered_by IN ('KIMI', 'CLAUDE')),
  prompt_name   text,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

-- ─── RATINGS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id    uuid        REFERENCES playlists(id) ON DELETE CASCADE,
  rated_by       uuid        REFERENCES auth.users(id),
  rating         integer     CHECK (rating BETWEEN 1 AND 5),
  feedback       text,
  tracks_kept    integer     NOT NULL DEFAULT 0,
  tracks_removed integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, rated_by)
);

-- ─── PROMPTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompts (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text        NOT NULL UNIQUE,
  label            text,
  genre            text,
  energy           text,
  bpm_min          integer,
  bpm_max          integer,
  timeframe        text,
  exclude_playlist text,
  "limit"          integer     NOT NULL DEFAULT 20,
  description      text,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── FEED ITEMS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_items (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source       text        NOT NULL CHECK (source IN ('beatport', '1001tracklists', 'youtube')),
  title        text        NOT NULL,
  artist       text,
  url          text,
  genre        text,
  label        text,
  published_at timestamptz,
  processed    boolean     NOT NULL DEFAULT false
);

-- ─── AGENT RUNS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent          text        NOT NULL CHECK (agent IN ('KIMI', 'CLAUDE')),
  prompt_name    text,
  tracks_found   integer     NOT NULL DEFAULT 0,
  tracks_matched integer     NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  status         text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tracks_discovered_at  ON tracks(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_agent          ON tracks(discovered_by);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started    ON agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_published  ON feed_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_source     ON feed_items(source);
CREATE INDEX IF NOT EXISTS idx_ratings_playlist      ON ratings(playlist_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE playlists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Playlists: all authenticated users can read; service role inserts
DROP POLICY IF EXISTS "playlists_select" ON playlists;
CREATE POLICY "playlists_select" ON playlists
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "playlists_insert" ON playlists;
CREATE POLICY "playlists_insert" ON playlists
  FOR INSERT TO authenticated WITH CHECK (true);

-- Tracks: all authenticated users can read/insert
DROP POLICY IF EXISTS "tracks_select" ON tracks;
CREATE POLICY "tracks_select" ON tracks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tracks_insert" ON tracks;
CREATE POLICY "tracks_insert" ON tracks
  FOR INSERT TO authenticated WITH CHECK (true);

-- Ratings: users see only their own; insert own; update own
DROP POLICY IF EXISTS "ratings_select" ON ratings;
CREATE POLICY "ratings_select" ON ratings
  FOR SELECT TO authenticated USING (rated_by = auth.uid());
DROP POLICY IF EXISTS "ratings_insert" ON ratings;
CREATE POLICY "ratings_insert" ON ratings
  FOR INSERT TO authenticated WITH CHECK (rated_by = auth.uid());
DROP POLICY IF EXISTS "ratings_update" ON ratings;
CREATE POLICY "ratings_update" ON ratings
  FOR UPDATE TO authenticated USING (rated_by = auth.uid());

-- Prompts: all see all; only creator can update/delete
DROP POLICY IF EXISTS "prompts_select" ON prompts;
CREATE POLICY "prompts_select" ON prompts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prompts_insert" ON prompts;
CREATE POLICY "prompts_insert" ON prompts
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "prompts_update" ON prompts;
CREATE POLICY "prompts_update" ON prompts
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
DROP POLICY IF EXISTS "prompts_delete" ON prompts;
CREATE POLICY "prompts_delete" ON prompts
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Feed items: read only for all authenticated
DROP POLICY IF EXISTS "feed_items_select" ON feed_items;
CREATE POLICY "feed_items_select" ON feed_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feed_items_insert" ON feed_items;
CREATE POLICY "feed_items_insert" ON feed_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- Agent runs: read only for all authenticated
DROP POLICY IF EXISTS "agent_runs_select" ON agent_runs;
CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;
CREATE POLICY "agent_runs_insert" ON agent_runs
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "agent_runs_update" ON agent_runs;
CREATE POLICY "agent_runs_update" ON agent_runs
  FOR UPDATE TO authenticated USING (true);
