-- Run once if you already created `words` before `words_word_unique` existed.
-- Fixes CSV import: upsert needs a unique constraint on `word`.

CREATE UNIQUE INDEX IF NOT EXISTS words_word_unique ON words (word);
