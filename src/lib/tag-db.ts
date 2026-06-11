import { supabase } from "@/lib/supabase";
import type { Tag, TagWithCount } from "@/lib/tags";

/** True when `supabase-migration-tags.sql` has not been applied yet. */
export function isMissingTagsTable(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the table") &&
    (msg.includes("tags") || msg.includes("word_tags"))
  );
}

function emptyTagsForWords<T extends { id: string }>(
  words: T[]
): (T & { tags: Tag[] })[] {
  return words.map((w) => ({ ...w, tags: [] }));
}

export async function fetchAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, created_at")
    .order("name", { ascending: true });
  if (error) {
    if (isMissingTagsTable(error)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function fetchTagById(id: string): Promise<Tag | null> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function countWordsPerTag(
  tagIds: string[],
  inMyWords = false
): Promise<Record<string, number>> {
  if (tagIds.length === 0) return {};

  let query = supabase.from("word_tags").select("tag_id, word_id");
  if (inMyWords) {
    const { data: progress } = await supabase
      .from("learning_progress")
      .select("word_id");
    const savedIds = new Set((progress ?? []).map((r) => r.word_id));
    if (savedIds.size === 0) return {};
    const { data, error } = await query.in("tag_id", tagIds);
    if (error) {
      if (isMissingTagsTable(error)) return {};
      throw new Error(error.message);
    }
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (!savedIds.has(row.word_id)) continue;
      counts[row.tag_id] = (counts[row.tag_id] ?? 0) + 1;
    }
    return counts;
  }

  const { data, error } = await query.in("tag_id", tagIds);
  if (error) {
    if (isMissingTagsTable(error)) return {};
    throw new Error(error.message);
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.tag_id] = (counts[row.tag_id] ?? 0) + 1;
  }
  return counts;
}

export async function getTagList(inMyWords = false): Promise<TagWithCount[]> {
  const tags = await fetchAllTags();
  const wordCounts = await countWordsPerTag(
    tags.map((t) => t.id),
    inMyWords
  );
  return tags.map((t) => ({
    ...t,
    word_count: wordCounts[t.id] ?? 0,
  }));
}

export async function getWordIdsForTagFilter(tagId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("word_tags")
    .select("word_id")
    .eq("tag_id", tagId);
  if (error) {
    if (isMissingTagsTable(error)) return [];
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).map((r) => r.word_id))];
}

export async function getTagsForWord(wordId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("word_tags")
    .select("tag_id")
    .eq("word_id", wordId);
  if (error) {
    if (isMissingTagsTable(error)) return [];
    throw new Error(error.message);
  }
  const tagIds = (data ?? []).map((r) => r.tag_id);
  if (tagIds.length === 0) return [];

  const allTags = await fetchAllTags();
  const byId = new Map(allTags.map((t) => [t.id, t]));
  return tagIds
    .map((id) => byId.get(id))
    .filter((t): t is Tag => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setWordTags(
  wordId: string,
  tagIds: string[]
): Promise<Tag[]> {
  const unique = [...new Set(tagIds.filter(Boolean))];

  const { error: delError } = await supabase
    .from("word_tags")
    .delete()
    .eq("word_id", wordId);
  if (delError) throw new Error(delError.message);

  if (unique.length > 0) {
    const { error: insError } = await supabase.from("word_tags").insert(
      unique.map((tag_id) => ({ word_id: wordId, tag_id }))
    );
    if (insError) throw new Error(insError.message);
  }

  return getTagsForWord(wordId);
}

export async function attachTagsToWords<T extends { id: string }>(
  words: T[]
): Promise<(T & { tags: Tag[] })[]> {
  if (words.length === 0) return [];
  const ids = words.map((w) => w.id);
  const { data, error } = await supabase
    .from("word_tags")
    .select("word_id, tag_id")
    .in("word_id", ids);
  if (error) {
    if (isMissingTagsTable(error)) return emptyTagsForWords(words);
    throw new Error(error.message);
  }

  const allTags = await fetchAllTags();
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const tagsByWord = new Map<string, Tag[]>();

  for (const row of data ?? []) {
    const tag = byId.get(row.tag_id);
    if (!tag) continue;
    const list = tagsByWord.get(row.word_id) ?? [];
    list.push(tag);
    tagsByWord.set(row.word_id, list);
  }

  return words.map((w) => ({
    ...w,
    tags: (tagsByWord.get(w.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  }));
}

export async function countWordLinks(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from("word_tags")
    .select("word_id", { count: "exact", head: true })
    .eq("tag_id", tagId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function tagNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  const trimmed = name.trim();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name")
    .ilike("name", trimmed);
  if (error) throw new Error(error.message);
  return (data ?? []).some(
    (t) => t.id !== excludeId && t.name.toLowerCase() === trimmed.toLowerCase()
  );
}

export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw new Error(error.message);
}

export async function mergeTags(
  sourceId: string,
  targetId: string
): Promise<void> {
  if (sourceId === targetId) throw new Error("Cannot merge a tag into itself");
  const source = await fetchTagById(sourceId);
  const target = await fetchTagById(targetId);
  if (!source || !target) throw new Error("Tag not found");

  const { data: sourceLinks, error: slErr } = await supabase
    .from("word_tags")
    .select("word_id")
    .eq("tag_id", sourceId);
  if (slErr) throw new Error(slErr.message);

  for (const row of sourceLinks ?? []) {
    const { data: existing } = await supabase
      .from("word_tags")
      .select("tag_id")
      .eq("word_id", row.word_id)
      .eq("tag_id", targetId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("word_tags")
        .delete()
        .eq("word_id", row.word_id)
        .eq("tag_id", sourceId);
    } else {
      await supabase
        .from("word_tags")
        .update({ tag_id: targetId })
        .eq("word_id", row.word_id)
        .eq("tag_id", sourceId);
    }
  }

  const { error: delErr } = await supabase.from("tags").delete().eq("id", sourceId);
  if (delErr) throw new Error(delErr.message);
}

export async function renameTag(tagId: string, name: string): Promise<Tag> {
  const tag = await fetchTagById(tagId);
  if (!tag) throw new Error("Tag not found");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name cannot be empty");
  if (await tagNameExists(trimmed, tagId)) {
    throw new Error(`A tag named "${trimmed}" already exists`);
  }

  const { error } = await supabase
    .from("tags")
    .update({ name: trimmed })
    .eq("id", tagId);
  if (error) throw new Error(error.message);

  const updated = await fetchTagById(tagId);
  if (!updated) throw new Error("Tag not found after rename");
  return updated;
}

export async function createTag(name: string): Promise<Tag> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name cannot be empty");
  if (await tagNameExists(trimmed)) {
    throw new Error(`A tag named "${trimmed}" already exists`);
  }

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: trimmed })
    .select("id, name, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
