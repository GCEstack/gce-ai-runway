-- Track metadata columns and playlist linkage
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS tags text,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS keep_remove text DEFAULT 'keep' CHECK (keep_remove IN ('keep', 'remove')),
  ADD COLUMN IF NOT EXISTS playlist_id uuid REFERENCES playlists(id) ON DELETE SET NULL;

-- Index for playlist track lookups
CREATE INDEX IF NOT EXISTS idx_tracks_playlist_id ON tracks(playlist_id);
