"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckSquare,
  ExternalLink,
  GitMerge,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TagWithCount } from "@/lib/tags";
import { filterTags } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function TagRowMenu({
  tag,
  onRename,
  onMerge,
  onDelete,
}: {
  tag: TagWithCount;
  onRename: (tag: TagWithCount) => void;
  onMerge: (tag: TagWithCount) => void;
  onDelete: (tag: TagWithCount) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0"
            aria-label={`Actions for ${tag.name}`}
          />
        }
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem
          render={
            <Link
              href={`/words?tag_id=${encodeURIComponent(tag.id)}&in_my_words=1`}
            />
          }
        >
          <ExternalLink className="size-4" />
          View in My collections
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRename(tag)}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMerge(tag)}>
          <GitMerge className="size-4" />
          Merge
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(tag)}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tags?in_my_words=1");
      if (res.ok) setTags(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterTags(tags, search), [tags, search]);
  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));

  const renameTarget = tags.find((t) => t.id === renameTargetId) ?? null;
  const deleteTargets = tags.filter((t) => deleteTargetIds.includes(t.id));
  const mergeSources = tags.filter((t) => mergeSourceIds.includes(t.id));

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openRename = (tag: TagWithCount) => {
    setRenameTargetId(tag.id);
    setRenameValue(tag.name);
    setRenameOpen(true);
  };

  const openMerge = (sourceIds: string[]) => {
    setMergeSourceIds(sourceIds);
    setMergeTargetId("");
    setMergeOpen(true);
  };

  const openDelete = (ids: string[]) => {
    setDeleteTargetIds(ids);
    setDeleteOpen(true);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Could not create tag");
      return;
    }
    toast.success("Tag created");
    setCreateOpen(false);
    setNewName("");
    await load();
  };

  const handleRename = async () => {
    if (!renameTargetId) return;
    const res = await fetch(`/api/tags/${renameTargetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Could not rename tag");
      return;
    }
    toast.success("Tag renamed");
    setRenameOpen(false);
    await load();
  };

  const handleMerge = async () => {
    const targetId = mergeTargetId.trim();
    const sources = mergeSourceIds.filter((id) => id !== targetId);
    if (!targetId || sources.length === 0 || merging) return;

    setMerging(true);
    try {
      for (const sourceId of sources) {
        const res = await fetch(`/api/tags/${sourceId}/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_tag_id: targetId }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Could not merge tags");
        }
      }
      toast.success(
        sources.length === 1 ? "Tags merged" : `${sources.length} tags merged`
      );
      setMergeOpen(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not merge tags");
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTargetIds.length === 0 || deleting) return;
    setDeleting(true);
    try {
      for (const id of deleteTargetIds) {
        const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Could not delete tag");
        }
      }
      toast.success(
        deleteTargetIds.length === 1
          ? "Tag deleted"
          : `${deleteTargetIds.length} tags deleted`
      );
      setDeleteOpen(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete tag");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div
        className={cn(
          "px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto w-full space-y-6",
          selectMode && "pb-28 md:pb-24"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectMode
                ? "Select tags for batch actions."
                : "Use the menu on each tag to rename, merge, or delete."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {filtered.length > 0 && !selectMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={enterSelectMode}
              >
                <CheckSquare className="size-4 mr-1.5" />
                Select
              </Button>
            )}
            {selectMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={exitSelectMode}
              >
                <X className="size-4 mr-1.5" />
                Done
              </Button>
            )}
            {!selectMode && (
              <Button
                size="sm"
                onClick={() => {
                  setNewName("");
                  setCreateOpen(true);
                }}
              >
                <Plus className="size-4 mr-1" />
                New tag
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="pl-10"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading tags…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? "No tags match your search." : "No tags yet. Create one to get started."}
          </p>
        ) : (
          <ul className="rounded-xl border divide-y overflow-hidden">
            {filtered.map((tag) => {
              const selected = selectedIds.has(tag.id);
              return (
                <li
                  key={tag.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 transition-colors",
                    selectMode && selected && "bg-primary/5",
                    selectMode && "cursor-pointer hover:bg-muted/40"
                  )}
                  onClick={
                    selectMode ? () => toggleSelect(tag.id) : undefined
                  }
                >
                  {selectMode && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={
                        selected ? `Deselect ${tag.name}` : `Select ${tag.name}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(tag.id);
                      }}
                      className={cn(
                        "shrink-0 inline-flex items-center justify-center size-5 rounded border transition-colors",
                        selected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50"
                      )}
                    >
                      {selected && <Check className="size-3" strokeWidth={3} />}
                    </button>
                  )}

                  {selectMode ? (
                    <span className="flex-1 min-w-0 font-medium truncate">
                      {tag.name}
                    </span>
                  ) : (
                    <Link
                      href={`/words?tag_id=${encodeURIComponent(tag.id)}&in_my_words=1`}
                      className="flex-1 min-w-0 font-medium truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tag.name}
                    </Link>
                  )}

                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {tag.word_count} {tag.word_count === 1 ? "item" : "items"}
                  </span>

                  {!selectMode && (
                    <TagRowMenu
                      tag={tag}
                      onRename={openRename}
                      onMerge={(t) => openMerge([t.id])}
                      onDelete={(t) => openDelete([t.id])}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectMode && (
        <div
          className="fixed inset-x-0 bottom-14 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] md:bottom-0"
          role="region"
          aria-label="Bulk tag actions"
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2.5 md:px-8">
            <span className="text-sm font-medium mr-auto">
              {selectedCount} selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={allFilteredSelected ? clearSelection : selectAllFiltered}
              disabled={filtered.length === 0}
            >
              {allFilteredSelected
                ? "Clear all"
                : `Select all (${filtered.length})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount < 2}
              onClick={() => openMerge([...selectedIds])}
            >
              <GitMerge className="size-4 mr-1.5" />
              Merge
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedCount === 0}
              onClick={() => openDelete([...selectedIds])}
            >
              <Trash2 className="size-4 mr-1.5" />
              Delete{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create tag</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
          <DialogFooter>
            <Button onClick={() => void handleCreate()} disabled={!newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename tag</DialogTitle>
            {renameTarget && (
              <DialogDescription>
                Rename <span className="font-medium">{renameTarget.name}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => void handleRename()} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mergeOpen}
        onOpenChange={(open) => {
          if (!open && !merging) setMergeOpen(false);
        }}
      >
        <DialogContent showCloseButton={!merging}>
          <DialogHeader>
            <DialogTitle>
              {mergeSources.length === 1
                ? "Merge into another tag"
                : `Merge ${mergeSources.length} tags into one`}
            </DialogTitle>
            <DialogDescription>
              {mergeSources.length === 1 ? (
                <>
                  All vocabulary tagged with{" "}
                  <span className="font-medium">{mergeSources[0]?.name}</span>{" "}
                  will move to the target tag.
                </>
              ) : (
                <>
                  These tags will be combined into one:{" "}
                  <span className="font-medium">
                    {mergeSources.map((t) => t.name).join(", ")}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Select
            value={mergeTargetId}
            onValueChange={(v) => v && setMergeTargetId(v)}
            disabled={merging}
          >
            <SelectTrigger>
              <SelectValue placeholder="Target tag" />
            </SelectTrigger>
            <SelectContent>
              {tags
                .filter((t) => !mergeSourceIds.includes(t.id))
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              {mergeSourceIds.length > 1 &&
                mergeSources.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} (keep this one)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={merging}
              onClick={() => setMergeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleMerge()}
              disabled={!mergeTargetId || merging}
            >
              {merging ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Merging…
                </>
              ) : (
                "Merge"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteOpen(false);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>
              {deleteTargets.length === 1
                ? "Delete tag"
                : `Delete ${deleteTargets.length} tags`}
            </DialogTitle>
            <DialogDescription>
              {deleteTargets.length === 1 ? (
                <>
                  Delete <span className="font-medium">{deleteTargets[0]?.name}</span>?
                  {deleteTargets[0] && deleteTargets[0].word_count > 0 && (
                    <>
                      {" "}
                      {deleteTargets[0].word_count} vocabulary item(s) will lose
                      this tag (the words themselves are not deleted).
                    </>
                  )}
                </>
              ) : (
                <>
                  Delete{" "}
                  <span className="font-medium">
                    {deleteTargets.map((t) => t.name).join(", ")}
                  </span>
                  ? Vocabulary will lose these tags; words are not deleted.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
