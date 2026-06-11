-- Merge phrase + sentence_pattern into a single entry_type: expression
-- Run once in the Supabase SQL Editor.

-- 1. Drop the old constraint first (it only allows word/phrase/sentence_pattern,
--    so updates to 'expression' would fail otherwise).
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_entry_type_check;

-- 2. Migrate existing rows.
UPDATE words
SET entry_type = 'expression'
WHERE entry_type IN ('phrase', 'sentence_pattern');

UPDATE words
SET entry_type = 'expression'
WHERE entry_type IS NULL AND word ~ '\s';

-- 3. Add the new constraint.
ALTER TABLE words
  ADD CONSTRAINT words_entry_type_check
  CHECK (entry_type IS NULL OR entry_type IN ('word', 'expression'));
