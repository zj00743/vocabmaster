import { supabase } from "@/lib/supabase";
import { getTagsForWord, mergeWordTags } from "@/lib/tag-db";

const MERGE_CONTENT_FIELDS = [
  "definition",
  "translation_zh",
  "ipa",
  "part_of_speech",
  "example_sentences",
  "synonyms",
  "antonyms",
  "collocations",
  "mnemonic",
  "image_url",
  "image_prompt",
  "show_image",
  "hide_dictionary_definition",
  "entry_type",
] as const;

function isEmptyField(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function buildMergePatch(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of MERGE_CONTENT_FIELDS) {
    if (field in updates) {
      patch[field] = updates[field];
      continue;
    }
    if (isEmptyField(target[field]) && !isEmptyField(source[field])) {
      patch[field] = source[field];
    }
  }
  return patch;
}

export type MergeCustomIntoExistingResult =
  | { ok: true; wordId: string }
  | { ok: false; reason: "target_in_collection" | "source_not_custom" };

/** Move a custom My collections card onto an existing dictionary row with the same title. */
export async function mergeCustomIntoExistingWord(
  sourceId: string,
  targetId: string,
  updates: Record<string, unknown>
): Promise<MergeCustomIntoExistingResult> {
  const { data: source, error: sourceError } = await supabase
    .from("words")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (sourceError || !source) {
    throw new Error(sourceError?.message ?? "Source word not found");
  }
  if (!source.is_custom) {
    return { ok: false, reason: "source_not_custom" };
  }

  const { data: target, error: targetError } = await supabase
    .from("words")
    .select("*")
    .eq("id", targetId)
    .single();
  if (targetError || !target) {
    throw new Error(targetError?.message ?? "Target word not found");
  }

  const { data: targetProgress } = await supabase
    .from("learning_progress")
    .select("id")
    .eq("word_id", targetId)
    .maybeSingle();
  if (targetProgress) {
    return { ok: false, reason: "target_in_collection" };
  }

  const patch = buildMergePatch(
    target as Record<string, unknown>,
    source as Record<string, unknown>,
    updates
  );
  delete patch.word;

  if (Object.keys(patch).length > 0) {
    const { error: patchError } = await supabase
      .from("words")
      .update(patch)
      .eq("id", targetId);
    if (patchError) throw new Error(patchError.message);
  }

  const { data: sourceProgress } = await supabase
    .from("learning_progress")
    .select("*")
    .eq("word_id", sourceId)
    .maybeSingle();

  if (sourceProgress) {
    const row = sourceProgress as Record<string, unknown>;
    const {
      id: _id,
      word_id: _wordId,
      created_at: _createdAt,
      ...progressFields
    } = row;
    await supabase.from("learning_progress").delete().eq("word_id", sourceId);
    const { error: insError } = await supabase.from("learning_progress").insert({
      ...progressFields,
      word_id: targetId,
    });
    if (insError) throw new Error(insError.message);
    await supabase
      .from("excluded_from_review")
      .delete()
      .eq("word_id", sourceId);
  }

  const sourceTags = await getTagsForWord(sourceId);
  if (sourceTags.length > 0) {
    await mergeWordTags(
      targetId,
      sourceTags.map((t) => t.id)
    );
  }

  await supabase.from("word_tags").delete().eq("word_id", sourceId);
  const { error: deleteError } = await supabase
    .from("words")
    .delete()
    .eq("id", sourceId);
  if (deleteError) throw new Error(deleteError.message);

  return { ok: true, wordId: targetId };
}
