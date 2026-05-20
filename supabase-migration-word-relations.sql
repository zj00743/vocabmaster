-- Run once in Supabase SQL Editor if your project already has `words.common_expressions`.
-- Adds synonyms / antonyms / collocations and copies legacy data into synonyms.

ALTER TABLE words ADD COLUMN IF NOT EXISTS synonyms JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE words ADD COLUMN IF NOT EXISTS antonyms JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE words ADD COLUMN IF NOT EXISTS collocations JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE words
SET synonyms = common_expressions
WHERE jsonb_array_length(COALESCE(synonyms, '[]'::jsonb)) = 0
  AND jsonb_array_length(COALESCE(common_expressions, '[]'::jsonb)) > 0;
