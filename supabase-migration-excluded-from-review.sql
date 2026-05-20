-- Run once in Supabase SQL Editor.
-- Tracks words the learner has explicitly removed from "My Words" so the
-- /api/review new-card filler doesn't keep re-suggesting them as new cards.

CREATE TABLE IF NOT EXISTS excluded_from_review (
  word_id UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excluded_from_review_excluded_at
  ON excluded_from_review(excluded_at DESC);

ALTER TABLE excluded_from_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on excluded_from_review" ON excluded_from_review;
CREATE POLICY "Allow all on excluded_from_review"
  ON excluded_from_review FOR ALL USING (true) WITH CHECK (true);
