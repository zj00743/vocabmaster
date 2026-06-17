"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TagWithCount } from "@/lib/tags";
import { filterTags, findTagByExactName } from "@/lib/tags";
import { cn } from "@/lib/utils";

export function useTags(inMyWords = true) {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return fetch(`/api/tags?in_my_words=${inMyWords ? "1" : "0"}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TagWithCount[]) => {
        const next = Array.isArray(data) ? data : [];
        setTags(next);
        return next;
      })
      .catch(() => {
        setTags([]);
        return [] as TagWithCount[];
      })
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
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const searchTrimmed = search.trim();
  const filtered = useMemo(
    () => filterTags(tags, searchTrimmed),
    [tags, searchTrimmed]
  );
  const exactMatch = useMemo(
    () => findTagByExactName(tags, searchTrimmed),
    [tags, searchTrimmed]
  );
  const showCreateOption = searchTrimmed.length > 0 && !exactMatch;

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const assignTag = (id: string) => {
    if (!selectedSet.has(id)) {
      onChange([...selectedIds, id]);
    }
  };

  const selectFromDropdown = (id: string) => {
    toggle(id);
    setSearch("");
  };

  const createAndAssign = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    const existing = findTagByExactName(tags, trimmed);
    if (existing) {
      assignTag(existing.id);
      setSearch("");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 409) {
          const refreshed = await reload();
          const match = findTagByExactName(refreshed, trimmed);
          if (match) {
            assignTag(match.id);
            setSearch("");
            return;
          }
        }
        throw new Error(j.error ?? "Could not create tag");
      }
      const created = (await res.json()) as { id: string };
      await reload();
      onChange([...new Set([...selectedIds, created.id])]);
      setSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create tag");
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
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or create tags…"
            className="h-9 text-sm"
            disabled={loading || creating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && showCreateOption) {
                e.preventDefault();
                void createAndAssign(searchTrimmed);
              }
            }}
          />
          {searchTrimmed ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-background shadow-md">
              {filtered.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto py-1">
                  {filtered.map((tag) => {
                    const selected = selectedSet.has(tag.id);
                    return (
                      <li key={tag.id}>
                        <button
                          type="button"
                          onClick={() => selectFromDropdown(tag.id)}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                            selected && "bg-primary/5 text-primary"
                          )}
                        >
                          <span>{tag.name}</span>
                          {selected ? (
                            <span className="text-xs text-muted-foreground">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No matching tags
                </p>
              )}
              {showCreateOption ? (
                <div className="border-t bg-muted/20 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 px-2 text-sm"
                    onClick={() => void createAndAssign(searchTrimmed)}
                    disabled={creating}
                  >
                    <Plus className="size-4 shrink-0" />
                    Create &ldquo;{searchTrimmed}&rdquo;
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {!searchTrimmed ? (
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border bg-background p-2">
            {tags.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                {loading ? "Loading…" : "No tags yet — search above to create one"}
              </p>
            ) : (
              tags.map((tag) => {
                const selected = selectedSet.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      selected
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-muted/30 hover:bg-muted/60"
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
