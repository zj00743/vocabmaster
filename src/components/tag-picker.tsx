"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TagWithCount } from "@/lib/tags";
import { filterTags } from "@/lib/tags";
import { cn } from "@/lib/utils";

export function useTags(inMyWords = true) {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return fetch(`/api/tags?in_my_words=${inMyWords ? "1" : "0"}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TagWithCount[]) => setTags(Array.isArray(data) ? data : []))
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, [inMyWords]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tags, loading, reload };
}

/** @deprecated Use useTags instead */
export const useTagTree = useTags;

export function TagPicker({
  selectedIds,
  onChange,
  className,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const { tags, loading, reload } = useTags(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => filterTags(tags, search), [tags, search]);

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
        body: JSON.stringify({ name }),
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
        {selectedIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags selected</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const name = byId.get(id)?.name ?? id;
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="font-sans text-xs gap-1 pr-1"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags…"
          className="h-9 text-sm"
          disabled={loading}
        />
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-lg border bg-background p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-2">
              {loading ? "Loading…" : "No tags found"}
            </p>
          ) : (
            filtered.map((tag) => {
              const selected = selectedSet.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-muted/30 hover:bg-muted/60"
                  )}
                >
                  {tag.name}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Create new tag</p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Kitchen"
            className="h-9 text-sm flex-1"
            disabled={loading || creating}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createTag();
              }
            }}
          />
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
