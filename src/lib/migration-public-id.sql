-- Migration: Model Public ID Forwarding for BYOK Gateway
-- Adds public_id column to models table for custom branded model IDs
-- ============================================================

-- Step 1: Add public_id column after id
ALTER TABLE models
  ADD COLUMN public_id VARCHAR(255) NULL DEFAULT NULL AFTER id,
  ADD UNIQUE INDEX idx_models_public_id (public_id);

-- Step 2: Auto-populate public_id for active models without one
-- Convention: milabs/{normalized-base-name}
-- Example: opencode-zen/deepseek-v4-flash-free → milabs/deepseek-v4-flash
UPDATE models
SET public_id = CONCAT(
  'milabs/',
  LOWER(REPLACE(REPLACE(SUBSTRING_INDEX(id, '/', -1), '-free', ''), 'DeepSeek', 'deepseek'))
)
WHERE status = 'active'
  AND public_id IS NULL;

-- Step 3: Resolve duplicates — keep only the first alphabetically by provider
-- For models sharing the same base name (e.g., opencode-zen/deepseek-v4 vs kr/deepseek-v4),
-- only the first one alphabetically keeps its public_id
SET @prev_base = '';
SET @row_num = 0;

-- Use a temporary table to mark duplicates
CREATE TEMPORARY TABLE tmp_dup_public_ids AS
SELECT id, public_id
FROM (
  SELECT
    id,
    public_id,
    @row_num := IF(@prev_base = public_id, @row_num + 1, 1) AS rn,
    @prev_base := public_id
  FROM models
  WHERE public_id IS NOT NULL
  ORDER BY public_id, provider ASC
) ranked
WHERE rn > 1;

-- Clear duplicate public_ids (set to NULL so admin can manually assign)
UPDATE models m
JOIN tmp_dup_public_ids d ON m.id = d.id
SET m.public_id = NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_dup_public_ids;

-- Step 4: Verify results
SELECT public_id, COUNT(*) as count
FROM models
WHERE public_id IS NOT NULL
GROUP BY public_id
HAVING count > 1;
-- If this returns 0 rows, duplicates are resolved
