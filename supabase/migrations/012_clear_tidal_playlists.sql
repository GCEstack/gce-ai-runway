-- Clear all Tidal-synced playlists for all users.
-- Related ratings are removed via ON DELETE CASCADE.
-- Related tracks are unlinked (playlist_id set to NULL) via ON DELETE SET NULL.

DELETE FROM playlists
WHERE service = 'tidal';

-- Refresh schema cache in case any cached plans relied on the data.
NOTIFY pgrst, 'reload schema';
