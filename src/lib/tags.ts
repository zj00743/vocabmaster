export type Tag = {
  id: string;
  name: string;
  created_at?: string;
};

export type TagWithCount = Tag & {
  word_count: number;
};

export function filterTags(tags: TagWithCount[], query: string): TagWithCount[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter((t) => t.name.toLowerCase().includes(q));
}

export function findTagByExactName(
  tags: TagWithCount[],
  name: string
): TagWithCount | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return tags.find((t) => t.name.toLowerCase() === q);
}
