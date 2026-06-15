-- Add status to playlists for soft-delete / sync tracking
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted'));

-- Index for fast active/deleted filtering
CREATE INDEX IF NOT EXISTS idx_playlists_status ON playlists(status);
