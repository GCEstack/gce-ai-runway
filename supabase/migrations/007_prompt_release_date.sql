-- Prompt release-date filtering + persist track release dates

-- ─── PROMPTS ──────────────────────────────────────────────────────────────────
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS release_date_range text DEFAULT 'last_3_months';

COMMENT ON COLUMN prompts.release_date_range IS
  'Track release-date filter: last_3_months, last_6_months, last_year, all';

-- Backfill existing prompts to the new default (last 3 months only).
UPDATE prompts
  SET release_date_range = 'last_3_months'
  WHERE release_date_range IS NULL;

-- ─── TRACKS ───────────────────────────────────────────────────────────────────
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS release_date date;

CREATE INDEX IF NOT EXISTS idx_tracks_release_date ON tracks(release_date DESC);
