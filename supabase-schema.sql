-- VocabMaster Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Words table: stores all vocabulary (CoCA + custom)
CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '',
  translation_zh TEXT NOT NULL DEFAULT '',
  ipa TEXT NOT NULL DEFAULT '',
  pronunciation_url TEXT,
  rank INTEGER,
  part_of_speech TEXT NOT NULL DEFAULT '',
  word_family TEXT,
  example_sentences JSONB NOT NULL DEFAULT '[]'::jsonb,
  synonyms JSONB NOT NULL DEFAULT '[]'::jsonb,
  antonyms JSONB NOT NULL DEFAULT '[]'::jsonb,
  collocations JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_expressions JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT,
  image_prompt TEXT,
  mnemonic TEXT,
  entry_type TEXT CHECK (entry_type IS NULL OR entry_type IN ('word', 'phrase', 'sentence_pattern')),
  show_image BOOLEAN,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Learning progress table: tracks spaced repetition state per word
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'review', 'mastered')),
  difficulty FLOAT NOT NULL DEFAULT 5.0,
  stability FLOAT NOT NULL DEFAULT 1.0,
  next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed TIMESTAMPTZ,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(word_id)
);

-- Reviews table: log of every review action
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_time INTEGER NOT NULL DEFAULT 0
);

-- Excluded-from-review table: tracks words the learner explicitly removed
-- from "My Words" so the /api/review new-card filler does not re-suggest
-- them. Cleared when the user re-adds the word from Search.
CREATE TABLE IF NOT EXISTS excluded_from_review (
  word_id UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance (unique on word is required for /api/import upsert)
CREATE UNIQUE INDEX IF NOT EXISTS words_word_unique ON words (word);
CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(LOWER(word));
CREATE INDEX IF NOT EXISTS idx_words_rank ON words(rank);
-- Hierarchical tags (see supabase-migration-tags.sql)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS word_tags (
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (word_id, tag_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_root_name
  ON tags (LOWER(name))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_child_name
  ON tags (parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_word_tags_tag_id ON word_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_word_tags_word_id ON word_tags(word_id);
CREATE INDEX IF NOT EXISTS idx_words_is_custom ON words(is_custom);
CREATE INDEX IF NOT EXISTS idx_words_entry_type ON words(entry_type);

CREATE INDEX IF NOT EXISTS idx_learning_progress_word_id ON learning_progress(word_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_status ON learning_progress(status);
CREATE INDEX IF NOT EXISTS idx_learning_progress_next_review ON learning_progress(next_review);

CREATE INDEX IF NOT EXISTS idx_reviews_word_id ON reviews(word_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_at ON reviews(reviewed_at);

CREATE INDEX IF NOT EXISTS idx_excluded_from_review_excluded_at
  ON excluded_from_review(excluded_at DESC);

-- Enable Row Level Security but allow all access (no auth)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE excluded_from_review ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations (single user, no auth)
-- DROP first so you can re-run this script without "policy already exists" errors.
DROP POLICY IF EXISTS "Allow all on tags" ON tags;
DROP POLICY IF EXISTS "Allow all on word_tags" ON word_tags;
DROP POLICY IF EXISTS "Allow all on words" ON words;
DROP POLICY IF EXISTS "Allow all on learning_progress" ON learning_progress;
DROP POLICY IF EXISTS "Allow all on reviews" ON reviews;
DROP POLICY IF EXISTS "Allow all on excluded_from_review" ON excluded_from_review;

CREATE POLICY "Allow all on tags" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on word_tags" ON word_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on words" ON words FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on learning_progress" ON learning_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on excluded_from_review" ON excluded_from_review FOR ALL USING (true) WITH CHECK (true);
