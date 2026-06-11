-- Merge phrase + sentence_pattern into a single entry_type: expression
-- Run once in the Supabase SQL Editor.

UPDATE words
SET entry_type = 'expression'
WHERE entry_type IN ('phrase', 'sentence_pattern');

UPDATE words
SET entry_type = 'expression'
WHERE entry_type IS NULL AND word ~ '\s';

ALTER TABLE words DROP CONSTRAINT IF EXISTS words_entry_type_check;
ALTER TABLE words
  ADD CONSTRAINT words_entry_type_check
  CHECK (entry_type IS NULL OR entry_type IN ('word', 'expression'));
