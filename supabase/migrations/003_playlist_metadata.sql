-- Playlist metadata columns
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS tags text,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS energy text CHECK (energy IN ('low', 'medium', 'high', 'peak')),
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
