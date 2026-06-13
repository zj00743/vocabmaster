-- Remember when a learner cleared the English definition so we do not show or
-- re-fill Merriam-Webster dictionary hints for that card.
--
-- Run once in the Supabase SQL Editor.

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS hide_dictionary_definition BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
