-- Adds an explicit entry type: 'word' | 'expression' (multi-word phrases,
-- sentence patterns, idioms, etc.).
--
-- Run once in the Supabase SQL Editor BEFORE deploying the app changes.

-- 1. Column: 'word' | 'expression'
ALTER TABLE words
  ADD COLUMN IF NOT EXISTS entry_type TEXT;

ALTER TABLE words
  DROP CONSTRAINT IF EXISTS words_entry_type_check;

-- 2. Backfill / migrate existing rows from whitespace (and legacy types).
UPDATE words
SET entry_type = 'expression'
WHERE entry_type IN ('phrase', 'sentence_pattern');

UPDATE words
SET entry_type = CASE
  WHEN word ~ '\s' THEN 'expression'
  ELSE 'word'
END
WHERE entry_type IS NULL;

ALTER TABLE words
  ADD CONSTRAINT words_entry_type_check
  CHECK (entry_type IS NULL OR entry_type IN ('word', 'expression'));

-- 3. Index to speed up the My collections "Type" filter.
CREATE INDEX IF NOT EXISTS idx_words_entry_type ON words(entry_type);
