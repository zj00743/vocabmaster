-- Adds an explicit entry type so "sentence pattern" can be distinguished from
-- plain multi-word "phrase" entries (both are multi-word, so type cannot be
-- inferred from text alone).
--
-- Run once in the Supabase SQL Editor BEFORE deploying the app changes.

-- 1. Column: 'word' | 'phrase' | 'sentence_pattern'
ALTER TABLE words
  ADD COLUMN IF NOT EXISTS entry_type TEXT;

ALTER TABLE words
  DROP CONSTRAINT IF EXISTS words_entry_type_check;
ALTER TABLE words
  ADD CONSTRAINT words_entry_type_check
  CHECK (entry_type IS NULL OR entry_type IN ('word', 'phrase', 'sentence_pattern'));

-- 2. Backfill existing rows from whitespace (no existing rows are sentence
--    patterns yet, so anything multi-word becomes 'phrase').
UPDATE words
SET entry_type = CASE
  WHEN word ~ '\s' THEN 'phrase'
  ELSE 'word'
END
WHERE entry_type IS NULL;

-- 3. Index to speed up the My collections "Type" filter.
CREATE INDEX IF NOT EXISTS idx_words_entry_type ON words(entry_type);
