-- Add external_created_at to playlists so we can store the date the playlist
-- was created on the external service (Tidal, Spotify, Beatport).

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS external_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_playlists_external_created_at
  ON playlists(external_created_at);

NOTIFY pgrst, 'reload schema';
