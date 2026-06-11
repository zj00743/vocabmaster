-- Hierarchical tag system (run in Supabase SQL Editor)
-- Replaces flat words.category / words.subcategory with normalized tags.

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

-- Sibling names must be unique under the same parent (root = parent_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_root_name
  ON tags (LOWER(name))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_child_name
  ON tags (parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
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

-- Seed default tag trees (skip if tags already exist).
DO $$
DECLARE
  scene_id UUID;
  function_id UUID;
  physical_id UUID;
  sensory_id UUID;
  outdoor_id UUID;
  fitness_id UUID;
  home_id UUID;
  travel_id UUID;
  work_id UUID;
  relationship_id UUID;
  storytelling_id UUID;
  observation_id UUID;
  evaluation_id UUID;
  conversation_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM tags LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO tags (name, parent_id) VALUES ('Scene', NULL) RETURNING id INTO scene_id;
  INSERT INTO tags (name, parent_id) VALUES ('Function', NULL) RETURNING id INTO function_id;
  INSERT INTO tags (name, parent_id) VALUES ('Physical', NULL) RETURNING id INTO physical_id;
  INSERT INTO tags (name, parent_id) VALUES ('Sensory', NULL) RETURNING id INTO sensory_id;

  INSERT INTO tags (name, parent_id) VALUES ('Outdoor', scene_id) RETURNING id INTO outdoor_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Biking', outdoor_id),
    ('Hiking', outdoor_id),
    ('Running', outdoor_id);

  INSERT INTO tags (name, parent_id) VALUES ('Fitness', scene_id) RETURNING id INTO fitness_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Strength Training', fitness_id),
    ('Running', fitness_id);

  INSERT INTO tags (name, parent_id) VALUES ('Home', scene_id) RETURNING id INTO home_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Kitchen', home_id),
    ('Cleaning', home_id),
    ('Laundry', home_id);

  INSERT INTO tags (name, parent_id) VALUES ('Travel', scene_id) RETURNING id INTO travel_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Airport', travel_id),
    ('Hotel', travel_id),
    ('Road Trip', travel_id);

  INSERT INTO tags (name, parent_id) VALUES ('Work', scene_id) RETURNING id INTO work_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Meeting', work_id),
    ('Design', work_id),
    ('Leadership', work_id);

  INSERT INTO tags (name, parent_id) VALUES ('Relationship', scene_id) RETURNING id INTO relationship_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Dating', relationship_id),
    ('Breakup', relationship_id),
    ('Marriage', relationship_id);

  INSERT INTO tags (name, parent_id) VALUES ('Storytelling', function_id) RETURNING id INTO storytelling_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Result', storytelling_id),
    ('Unexpected', storytelling_id),
    ('Timeline', storytelling_id),
    ('Reflection', storytelling_id);

  INSERT INTO tags (name, parent_id) VALUES ('Observation', function_id) RETURNING id INTO observation_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Funny', observation_id),
    ('Visual', observation_id),
    ('Behavior', observation_id);

  INSERT INTO tags (name, parent_id) VALUES ('Evaluation', function_id) RETURNING id INTO evaluation_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Positive', evaluation_id),
    ('Negative', evaluation_id);

  INSERT INTO tags (name, parent_id) VALUES ('Conversation', function_id) RETURNING id INTO conversation_id;
  INSERT INTO tags (name, parent_id) VALUES
    ('Agreement', conversation_id),
    ('Softening', conversation_id),
    ('Reaction', conversation_id);

  INSERT INTO tags (name, parent_id) VALUES
    ('Injury', physical_id),
    ('Pain', physical_id),
    ('Fatigue', physical_id),
    ('Heat', physical_id),
    ('Cold', physical_id);

  INSERT INTO tags (name, parent_id) VALUES
    ('Visual', sensory_id),
    ('Sound', sensory_id),
    ('Smell', sensory_id),
    ('Touch', sensory_id),
    ('Movement', sensory_id);
END $$;
