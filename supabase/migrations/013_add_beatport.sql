-- Migration 013: Add Beatport support
-- Adds 'beatport' to the allowed service and source values

-- Drop old constraints
ALTER TABLE playlists
  DROP CONSTRAINT IF EXISTS playlists_service_check;

ALTER TABLE tracks
  DROP CONSTRAINT IF EXISTS tracks_source_check;

-- Add new constraints with beatport
ALTER TABLE playlists
  ADD CONSTRAINT playlists_service_check
  CHECK (service IN ('spotify', 'tidal', 'beatport'));

ALTER TABLE tracks
  ADD CONSTRAINT tracks_source_check
  CHECK (source IN ('spotify', 'tidal', 'beatport'));

-- Add index for beatport lookups
CREATE INDEX IF NOT EXISTS idx_playlists_service_beatport
  ON playlists(service) WHERE service = 'beatport';
