-- Add unnatural_english: learner notes on awkward or incorrect English usages.
ALTER TABLE words
  ADD COLUMN IF NOT EXISTS unnatural_english JSONB NOT NULL DEFAULT '[]'::jsonb;
