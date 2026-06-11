"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagTree } from "@/components/tag-tree";
import type { TagTreeNode } from "@/lib/tags";
import { cn } from "@/lib/utils";

export function useTagTree(inMyWords = true) {
  const [tree, setTree] = useState<TagTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return fetch(`/api/tags?in_my_words=${inMyWords ? "1" : "0"}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TagTreeNode[]) => setTree(Array.isArray(data) ? data : []))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [inMyWords]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tree, loading, reload };
}

function flattenTree(nodes: TagTreeNode[]): TagTreeNode[] {
  const out: TagTreeNode[] = [];
  const walk = (list: TagTreeNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function TagPicker({
  selectedIds,
  onChange,
  className,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const { tree, loading, reload } = useTagTree(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState<string>("__root__");
  const [creating, setCreating] = useState(false);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const byId = useMemo(() => new Map(flat.map((t) => [t.id, t])), [flat]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedPaths = selectedIds
    .map((id) => byId.get(id)?.path)
    .filter((p): p is string => Boolean(p))
    .sort();

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const createTag = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parent_id: parentId === "__root__" ? null : parentId,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Could not create tag");
      }
      const created = (await res.json()) as { id: string };
      await reload();
      onChange([...new Set([...selectedIds, created.id])]);
      setNewName("");
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Selected tags</span>
        {selectedPaths.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags selected</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const path = byId.get(id)?.path ?? id;
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="font-sans text-xs gap-1 pr-1"
                >
                  {path}
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${path}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <TagTree
        tree={tree}
        search={search}
        onSearchChange={setSearch}
        selectedIds={selectedSet}
        onToggleSelect={(id) => toggle(id)}
        showCounts={false}
        multiSelect
      />

      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Create new tag</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Name
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Kitchen"
              className="h-9 text-sm"
              disabled={loading || creating}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Parent
            <Select
              value={parentId}
              onValueChange={(v) => v && setParentId(v)}
              disabled={loading || creating}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">Top level</SelectItem>
                {flat.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => void createTag()}
            disabled={!newName.trim() || creating}
          >
            <Plus className="size-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
