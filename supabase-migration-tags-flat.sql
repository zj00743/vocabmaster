-- Flatten hierarchical tags → simple flat tags (run once in Supabase SQL Editor)
-- Safe to run if you previously applied supabase-migration-tags.sql with parent_id.

-- 1. Build full paths for nested tags so names stay unique after flattening.
WITH RECURSIVE tag_paths AS (
  SELECT id, name, parent_id, name::text AS full_path
  FROM tags
  WHERE parent_id IS NULL
  UNION ALL
  SELECT t.id, t.name, t.parent_id, tp.full_path || ' / ' || t.name
  FROM tags t
  JOIN tag_paths tp ON t.parent_id = tp.id
)
UPDATE tags
SET name = tp.full_path
FROM tag_paths tp
WHERE tags.id = tp.id
  AND tp.parent_id IS NOT NULL;

-- 2. Drop hierarchy column and old indexes (if present).
DROP INDEX IF EXISTS idx_tags_root_name;
DROP INDEX IF EXISTS idx_tags_child_name;
DROP INDEX IF EXISTS idx_tags_parent_id;

ALTER TABLE tags DROP COLUMN IF EXISTS parent_id;

-- 3. Enforce globally unique tag names.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags (LOWER(name));

-- 4. Merge duplicate names (case-insensitive): keep oldest tag, move word links.
DO $$
DECLARE
  dup RECORD;
  keeper UUID;
  loser UUID;
BEGIN
  FOR dup IN
    SELECT LOWER(name) AS lname, array_agg(id ORDER BY created_at) AS ids
    FROM tags
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
  LOOP
    keeper := dup.ids[1];
    FOR i IN 2..array_length(dup.ids, 1) LOOP
      loser := dup.ids[i];
      -- Move word links from loser to keeper (skip conflicts).
      UPDATE word_tags wt
      SET tag_id = keeper
      WHERE wt.tag_id = loser
        AND NOT EXISTS (
          SELECT 1 FROM word_tags x
          WHERE x.word_id = wt.word_id AND x.tag_id = keeper
        );
      DELETE FROM word_tags WHERE tag_id = loser;
      DELETE FROM tags WHERE id = loser;
    END LOOP;
  END LOOP;
END $$;
