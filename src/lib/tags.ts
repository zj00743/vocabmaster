export type TagRow = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
};

export type TagWithPath = TagRow & {
  path: string;
  depth: number;
};

export type TagTreeNode = TagWithPath & {
  count: number;
  word_count: number;
  children: TagTreeNode[];
};

export function tagPathFor(
  tagId: string,
  byId: Map<string, TagRow>
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = byId.get(tagId);
  while (cur) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.join("/");
}

export function enrichTagsWithPaths(tags: TagRow[]): TagWithPath[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  return tags.map((t) => {
    const path = tagPathFor(t.id, byId);
    return {
      ...t,
      path,
      depth: path ? path.split("/").length - 1 : 0,
    };
  });
}

export function buildTagTree(
  tags: TagWithPath[],
  wordCounts: Record<string, number> = {}
): TagTreeNode[] {
  const nodes = new Map<string, TagTreeNode>();
  for (const t of tags) {
    nodes.set(t.id, {
      ...t,
      count: 0,
      word_count: wordCounts[t.id] ?? 0,
      children: [],
    });
  }

  const roots: TagTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: TagTreeNode[]): TagTreeNode[] => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of list) {
      n.children = sortNodes(n.children);
      n.count = n.children.length;
    }
    return list;
  };
  sortNodes(roots);
  return roots;
}

export function collectDescendantIds(
  rootId: string,
  tags: TagRow[]
): Set<string> {
  const childrenByParent = new Map<string | null, TagRow[]>();
  for (const t of tags) {
    const key = t.parent_id;
    const list = childrenByParent.get(key) ?? [];
    list.push(t);
    childrenByParent.set(key, list);
  }

  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const child of childrenByParent.get(id) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return result;
}

export function collectSubtreeIds(
  rootId: string,
  tags: TagRow[]
): string[] {
  return [...collectDescendantIds(rootId, tags)];
}

export function filterTagTree(
  tree: TagTreeNode[],
  query: string
): TagTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;

  const walk = (node: TagTreeNode): TagTreeNode | null => {
    const nameMatch =
      node.name.toLowerCase().includes(q) ||
      node.path.toLowerCase().includes(q);
    const children = node.children
      .map(walk)
      .filter((n): n is TagTreeNode => n !== null);
    if (nameMatch || children.length > 0) {
      return { ...node, children };
    }
    return null;
  };

  return tree.map(walk).filter((n): n is TagTreeNode => n !== null);
}

export function formatTagLabel(path: string): string {
  return path;
}
