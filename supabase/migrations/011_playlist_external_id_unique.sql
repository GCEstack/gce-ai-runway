-- Deduplicate playlists and enforce unique (user_id, service, external_id).
-- Runway sync uses upsert on external_id, but without a unique constraint
-- each sync inserted new rows, causing duplicates.

-- Clean up any leftover temp table from a previous interrupted run.
DROP TABLE IF EXISTS playlists_to_delete;

-- 1. Identify duplicates, keeping the row with the latest created_at per group.
CREATE TEMP TABLE playlists_to_delete AS
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

-- 2. Move tracks from duplicate playlists to the kept playlist.
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
FROM playlists_to_delete d
JOIN kept k
  ON k.user_id = d.user_id
  AND k.service = d.service
  AND k.external_id = d.external_id
WHERE t.playlist_id = d.id;

-- 3. Delete ratings tied to duplicate playlists.
DELETE FROM ratings
WHERE playlist_id IN (SELECT id FROM playlists_to_delete);

-- 4. Delete duplicate playlists.
DELETE FROM playlists
WHERE id IN (SELECT id FROM playlists_to_delete);

-- 5. Drop temp table.
DROP TABLE playlists_to_delete;

-- 6. Add unique constraint.
ALTER TABLE playlists
  ADD CONSTRAINT playlists_user_service_external_id_unique
  UNIQUE (user_id, service, external_id);

-- 7. Add an index for faster upsert lookups.
CREATE INDEX IF NOT EXISTS idx_playlists_user_service_external_id
  ON playlists(user_id, service, external_id);

-- 8. Refresh schema cache.
NOTIFY pgrst, 'reload schema';
