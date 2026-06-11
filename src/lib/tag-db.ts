import { supabase } from "@/lib/supabase";
import {
  type TagRow,
  type TagTreeNode,
  type TagWithPath,
  buildTagTree,
  collectDescendantIds,
  collectSubtreeIds,
  enrichTagsWithPaths,
  tagPathFor,
} from "@/lib/tags";

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
): (T & { tags: TagWithPath[] })[] {
  return words.map((w) => ({ ...w, tags: [] }));
}

export async function fetchAllTags(): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, parent_id, created_at")
    .order("name", { ascending: true });
  if (error) {
    if (isMissingTagsTable(error)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function fetchTagById(id: string): Promise<TagRow | null> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, parent_id, created_at")
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
    query = query.in("tag_id", tagIds);
    const { data, error } = await query;
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

  query = query.in("tag_id", tagIds);
  const { data, error } = await query;
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

export async function getTagTree(inMyWords = false): Promise<TagTreeNode[]> {
  const tags = await fetchAllTags();
  const enriched = enrichTagsWithPaths(tags);
  const wordCounts = await countWordsPerTag(
    tags.map((t) => t.id),
    inMyWords
  );
  return buildTagTree(enriched, wordCounts);
}

export async function getWordIdsForTagFilter(
  tagId: string,
  includeDescendants: boolean
): Promise<string[]> {
  const tags = await fetchAllTags();
  const targetIds = includeDescendants
    ? [...collectDescendantIds(tagId, tags)]
    : [tagId];

  const { data, error } = await supabase
    .from("word_tags")
    .select("word_id")
    .in("tag_id", targetIds);
  if (error) {
    if (isMissingTagsTable(error)) return [];
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).map((r) => r.word_id))];
}

export async function getTagsForWord(wordId: string): Promise<TagWithPath[]> {
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
    .filter((t): t is TagRow => Boolean(t))
    .map((t) => {
      const path = tagPathFor(t.id, byId);
      return {
        ...t,
        path,
        depth: path.split("/").length - 1,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function setWordTags(
  wordId: string,
  tagIds: string[]
): Promise<TagWithPath[]> {
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
): Promise<(T & { tags: TagWithPath[] })[]> {
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
  const tagsByWord = new Map<string, TagWithPath[]>();

  for (const row of data ?? []) {
    const tag = byId.get(row.tag_id);
    if (!tag) continue;
    const path = tagPathFor(tag.id, byId);
    const enriched: TagWithPath = {
      ...tag,
      path,
      depth: path.split("/").length - 1,
    };
    const list = tagsByWord.get(row.word_id) ?? [];
    list.push(enriched);
    tagsByWord.set(row.word_id, list);
  }

  return words.map((w) => ({
    ...w,
    tags: (tagsByWord.get(w.id) ?? []).sort((a, b) =>
      a.path.localeCompare(b.path)
    ),
  }));
}

export async function countDirectChildren(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from("tags")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", tagId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countDirectWordLinks(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from("word_tags")
    .select("word_id", { count: "exact", head: true })
    .eq("tag_id", tagId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function wouldCreateSiblingDuplicate(
  name: string,
  parentId: string | null,
  excludeId?: string
): Promise<boolean> {
  const trimmed = name.trim();
  let query = supabase
    .from("tags")
    .select("id, name")
    .ilike("name", trimmed);

  if (parentId) {
    query = query.eq("parent_id", parentId);
  } else {
    query = query.is("parent_id", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).some(
    (t) => t.id !== excludeId && t.name.toLowerCase() === trimmed.toLowerCase()
  );
}

export async function isDescendantOf(
  tagId: string,
  ancestorId: string
): Promise<boolean> {
  const tags = await fetchAllTags();
  const byId = new Map(tags.map((t) => [t.id, t]));
  let cur = byId.get(tagId);
  const seen = new Set<string>();
  while (cur?.parent_id) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    if (cur.parent_id === ancestorId) return true;
    cur = byId.get(cur.parent_id);
  }
  return false;
}

export async function deleteTagWithMode(
  tagId: string,
  mode: "tag_only" | "tag_and_children" | "move_vocab",
  moveToTagId?: string
): Promise<void> {
  const childCount = await countDirectChildren(tagId);
  const wordCount = await countDirectWordLinks(tagId);

  if (mode === "tag_only") {
    if (childCount > 0 || wordCount > 0) {
      throw new Error(
        "Tag has children or vocabulary items. Choose another delete option."
      );
    }
    const { error } = await supabase.from("tags").delete().eq("id", tagId);
    if (error) throw new Error(error.message);
    return;
  }

  if (mode === "move_vocab") {
    if (!moveToTagId) throw new Error("move_to tag is required");
    if (moveToTagId === tagId) throw new Error("Cannot move vocabulary to the same tag");
    const moveTarget = await fetchTagById(moveToTagId);
    if (!moveTarget) throw new Error("Target tag not found");
    if (await isDescendantOf(moveToTagId, tagId)) {
      throw new Error("Cannot move vocabulary to a descendant tag");
    }

    const { data: links, error: linkErr } = await supabase
      .from("word_tags")
      .select("word_id")
      .eq("tag_id", tagId);
    if (linkErr) throw new Error(linkErr.message);

    for (const row of links ?? []) {
      const { data: existing } = await supabase
        .from("word_tags")
        .select("tag_id")
        .eq("word_id", row.word_id)
        .eq("tag_id", moveToTagId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("word_tags")
          .delete()
          .eq("word_id", row.word_id)
          .eq("tag_id", tagId);
      } else {
        await supabase
          .from("word_tags")
          .update({ tag_id: moveToTagId })
          .eq("word_id", row.word_id)
          .eq("tag_id", tagId);
      }
    }

    const { error } = await supabase.from("tags").delete().eq("id", tagId);
    if (error) throw new Error(error.message);
    return;
  }

  // tag_and_children: ON DELETE CASCADE on parent_id handles subtree
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
  if (await isDescendantOf(targetId, sourceId)) {
    throw new Error("Cannot merge into a descendant tag");
  }

  const allTags = await fetchAllTags();

  // Reparent direct children of source to target
  const { error: reparentErr } = await supabase
    .from("tags")
    .update({ parent_id: targetId })
    .eq("parent_id", sourceId);
  if (reparentErr) throw new Error(reparentErr.message);

  // Move word associations source -> target (dedupe)
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

  void allTags;
}

export async function moveTag(
  tagId: string,
  newParentId: string | null
): Promise<TagWithPath> {
  const tag = await fetchTagById(tagId);
  if (!tag) throw new Error("Tag not found");
  if (newParentId === tagId) throw new Error("A tag cannot be its own parent");
  if (newParentId && (await isDescendantOf(newParentId, tagId))) {
    throw new Error("Cannot move a tag under its own descendant");
  }
  if (newParentId) {
    const parent = await fetchTagById(newParentId);
    if (!parent) throw new Error("Parent tag not found");
  }

  if (
    await wouldCreateSiblingDuplicate(tag.name, newParentId, tagId)
  ) {
    throw new Error(
      `A sibling tag named "${tag.name}" already exists under that parent`
    );
  }

  const { error } = await supabase
    .from("tags")
    .update({ parent_id: newParentId })
    .eq("id", tagId);
  if (error) throw new Error(error.message);

  const updated = await fetchTagById(tagId);
  if (!updated) throw new Error("Tag not found after move");
  const allTags = await fetchAllTags();
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const path = tagPathFor(updated.id, byId);
  return { ...updated, path, depth: path.split("/").length - 1 };
}

export async function renameTag(
  tagId: string,
  name: string
): Promise<TagWithPath> {
  const tag = await fetchTagById(tagId);
  if (!tag) throw new Error("Tag not found");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name cannot be empty");
  if (
    await wouldCreateSiblingDuplicate(trimmed, tag.parent_id, tagId)
  ) {
    throw new Error(
      `A sibling tag named "${trimmed}" already exists under that parent`
    );
  }

  const { error } = await supabase
    .from("tags")
    .update({ name: trimmed })
    .eq("id", tagId);
  if (error) throw new Error(error.message);

  const updated = await fetchTagById(tagId);
  if (!updated) throw new Error("Tag not found after rename");
  const allTags = await fetchAllTags();
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const path = tagPathFor(updated.id, byId);
  return { ...updated, path, depth: path.split("/").length - 1 };
}

export async function createTag(
  name: string,
  parentId: string | null
): Promise<TagWithPath> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name cannot be empty");
  if (await wouldCreateSiblingDuplicate(trimmed, parentId)) {
    throw new Error(
      `A sibling tag named "${trimmed}" already exists under that parent`
    );
  }
  if (parentId) {
    const parent = await fetchTagById(parentId);
    if (!parent) throw new Error("Parent tag not found");
  }

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: trimmed, parent_id: parentId })
    .select("id, name, parent_id, created_at")
    .single();
  if (error) throw new Error(error.message);

  const allTags = await fetchAllTags();
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const path = tagPathFor(data.id, byId);
  return { ...data, path, depth: path.split("/").length - 1 };
}

export { collectSubtreeIds };
