-- Add preferred_service hint to prompts (UI default, not enforced)

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS preferred_service text DEFAULT 'beatport';

COMMENT ON COLUMN prompts.preferred_service IS
  'UI hint for which service this prompt works best with: spotify, tidal, or beatport';

-- Backfill existing prompts to beatport as default (most prompts were designed for it)
UPDATE prompts
  SET preferred_service = 'beatport'
  WHERE preferred_service IS NULL;
