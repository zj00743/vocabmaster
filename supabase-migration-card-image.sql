-- Per-card image toggle. NULL means "use the default": images are hidden for
-- sentence patterns and shown for words/phrases. An explicit true/false wins.
--
-- Run once in the Supabase SQL Editor.

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS show_image BOOLEAN;

NOTIFY pgrst, 'reload schema';
