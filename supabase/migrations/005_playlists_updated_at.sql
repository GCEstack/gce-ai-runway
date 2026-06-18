-- Add updated_at to playlists for metadata sync timestamps
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
