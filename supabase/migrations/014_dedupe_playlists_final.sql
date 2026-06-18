-- Final deduplication cleanup for playlists.
-- Keeps the newest row per (user_id, service, external_id) and ensures the
-- unique constraint exists.

DROP TABLE IF EXISTS playlists_dedupe_to_delete;

-- Identify duplicates (external_id not null).
CREATE TEMP TABLE playlists_dedupe_to_delete AS
WITH ranked AS (
  SELECT
    id,
    user_id,
    service,
    external_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, service, external_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM playlists
  WHERE external_id IS NOT NULL
)
SELECT id, user_id, service, external_id
FROM ranked
WHERE rn > 1;

-- Re-link tracks from rows we are about to delete.
WITH kept AS (
  SELECT DISTINCT ON (p.user_id, p.service, p.external_id)
    p.user_id,
    p.service,
    p.external_id,
    p.id AS kept_id
  FROM playlists p
  WHERE p.external_id IS NOT NULL
  ORDER BY p.user_id, p.service, p.external_id, p.created_at DESC, p.id DESC
)
UPDATE tracks t
SET playlist_id = k.kept_id
FROM playlists_dedupe_to_delete d
JOIN kept k
  ON k.user_id = d.user_id
  AND k.service = d.service
  AND k.external_id = d.external_id
WHERE t.playlist_id = d.id;

-- Remove ratings tied to duplicate playlists.
DELETE FROM ratings
WHERE playlist_id IN (SELECT id FROM playlists_dedupe_to_delete);

-- Delete duplicate playlist rows.
DELETE FROM playlists
WHERE id IN (SELECT id FROM playlists_dedupe_to_delete);

DROP TABLE playlists_dedupe_to_delete;

-- Ensure unique constraint exists.
ALTER TABLE playlists
  DROP CONSTRAINT IF EXISTS playlists_user_service_external_id_unique;

ALTER TABLE playlists
  ADD CONSTRAINT playlists_user_service_external_id_unique
  UNIQUE (user_id, service, external_id);

-- Ensure supporting index exists.
CREATE INDEX IF NOT EXISTS idx_playlists_user_service_external_id
  ON playlists(user_id, service, external_id);

NOTIFY pgrst, 'reload schema';
