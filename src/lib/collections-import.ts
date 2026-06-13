import { supabase } from "@/lib/supabase";
import type { CollectionsImportRow } from "@/lib/collections-import-csv";
import {
  mergeWordTags,
  resolveTagIdsByNames,
} from "@/lib/tag-db";
import {
  normalizeEntryTypeForStorage,
  resolveShowImage,
} from "@/lib/word-entry";

export type CollectionsImportResult = {
  added: number;
  already_in_collection: number;
  skipped: number;
  tags_created: number;
  tags_linked: number;
  total: number;
  errors: string[];
};

async function ensureLearningProgress(wordId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("learning_progress")
    .select("id")
    .eq("word_id", wordId)
    .maybeSingle();

  if (existing) return false;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { error } = await supabase.from("learning_progress").insert({
    word_id: wordId,
    status: "new",
    difficulty: 5.0,
    stability: 0.4,
    next_review: tomorrow.toISOString(),
    last_reviewed: null,
    review_count: 0,
  });

  if (error) throw new Error(error.message);

  await supabase
    .from("excluded_from_review")
    .delete()
    .eq("word_id", wordId);

  return true;
}

function patchFromRow(
  row: CollectionsImportRow,
  existing?: Record<string, unknown>
) {
  const patch: Record<string, unknown> = {};
  const entry_type = normalizeEntryTypeForStorage(
    row.entry_type,
    row.word
  );

  if (!existing || existing.is_custom) {
    patch.entry_type = entry_type;
    if (row.definition) patch.definition = row.definition;
    if (row.translation_zh) patch.translation_zh = row.translation_zh;
    if (row.part_of_speech) patch.part_of_speech = row.part_of_speech;
    if (row.ipa) patch.ipa = row.ipa;
    if (row.example_sentences.length > 0) {
      patch.example_sentences = row.example_sentences;
    }
    if (row.synonyms.length > 0) patch.synonyms = row.synonyms;
    if (row.antonyms.length > 0) patch.antonyms = row.antonyms;
    if (row.collocations.length > 0) patch.collocations = row.collocations;
  } else {
    if (row.translation_zh) patch.translation_zh = row.translation_zh;
  }

  if (row.show_image !== null) {
    patch.show_image = row.show_image;
  } else if (!existing) {
    patch.show_image = resolveShowImage(row.word, entry_type, null);
  }

  return patch;
}

async function importRow(
  row: CollectionsImportRow
): Promise<{
  added: boolean;
  skipped: boolean;
  tagsCreated: number;
  tagsLinked: number;
  error?: string;
}> {
  const lemma = row.word.trim();
  if (!lemma) {
    return { added: false, skipped: true, tagsCreated: 0, tagsLinked: 0 };
  }

  const { data: existing } = await supabase
    .from("words")
    .select("*")
    .eq("word", lemma)
    .maybeSingle();

  let wordId: string;

  if (existing) {
    wordId = existing.id as string;
    const patch = patchFromRow(row, existing as Record<string, unknown>);
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("words")
        .update(patch)
        .eq("id", wordId);
      if (error) throw new Error(error.message);
    }
  } else {
    const entry_type = normalizeEntryTypeForStorage(row.entry_type, lemma);
    const { data: created, error } = await supabase
      .from("words")
      .insert({
        word: lemma,
        entry_type,
        show_image: resolveShowImage(lemma, entry_type, row.show_image),
        definition: row.definition,
        translation_zh: row.translation_zh,
        ipa: row.ipa,
        part_of_speech: row.part_of_speech,
        example_sentences: row.example_sentences,
        synonyms: row.synonyms,
        antonyms: row.antonyms,
        collocations: row.collocations,
        is_custom: true,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    wordId = created.id;
  }

  const added = await ensureLearningProgress(wordId);

  let tagsCreated = 0;
  let tagsLinked = 0;
  if (row.tags.length > 0) {
    const { ids, created } = await resolveTagIdsByNames(row.tags);
    tagsCreated = created;
    tagsLinked = ids.length;
    await mergeWordTags(wordId, ids);
  }

  return { added, skipped: false, tagsCreated, tagsLinked };
}

export async function importRowsToCollections(
  rows: CollectionsImportRow[]
): Promise<CollectionsImportResult> {
  const result: CollectionsImportResult = {
    added: 0,
    already_in_collection: 0,
    skipped: 0,
    tags_created: 0,
    tags_linked: 0,
    total: rows.length,
    errors: [],
  };

  for (const row of rows) {
    try {
      const rowResult = await importRow(row);
      if (rowResult.skipped) {
        result.skipped += 1;
        continue;
      }
      if (rowResult.added) result.added += 1;
      else result.already_in_collection += 1;
      result.tags_created += rowResult.tagsCreated;
      result.tags_linked += rowResult.tagsLinked;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      result.errors.push(`"${row.word}": ${msg}`);
    }
  }

  return result;
}
