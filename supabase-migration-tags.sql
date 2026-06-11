-- Flat tag system (run in Supabase SQL Editor)
-- Replaces flat words.category / words.subcategory with normalized tags.

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS word_tags (
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (word_id, tag_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_word_tags_tag_id ON word_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_word_tags_word_id ON word_tags(word_id);

-- Row Level Security (same pattern as words / learning_progress — single-user app)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on tags" ON tags;
DROP POLICY IF EXISTS "Allow all on word_tags" ON word_tags;

CREATE POLICY "Allow all on tags" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on word_tags" ON word_tags FOR ALL USING (true) WITH CHECK (true);

-- Optional: drop legacy columns after deploying the app update.
-- ALTER TABLE words DROP COLUMN IF EXISTS category;
-- ALTER TABLE words DROP COLUMN IF EXISTS subcategory;

-- Seed default tags (skip if tags already exist).
INSERT INTO tags (name)
SELECT v.name
FROM (VALUES
  ('Biking'),
  ('Hiking'),
  ('Running'),
  ('Strength Training'),
  ('Kitchen'),
  ('Cleaning'),
  ('Travel'),
  ('Work'),
  ('Dating'),
  ('Funny'),
  ('Injury'),
  ('Casual'),
  ('Academic')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM tags LIMIT 1);
