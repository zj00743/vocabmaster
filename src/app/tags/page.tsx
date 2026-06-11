"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FolderTree,
  GitMerge,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
import { TagForest } from "@/components/tag-forest";
import type { TagTreeNode } from "@/lib/tags";
import { toast } from "sonner";

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

export default function TagsPage() {
  const [tree, setTree] = useState<TagTreeNode[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("__root__");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveParentId, setMoveParentId] = useState<string>("__root__");

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<{
    path: string;
    child_count: number;
    word_count: number;
    can_delete_only: boolean;
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<
    "tag_only" | "tag_and_children" | "move_vocab"
  >("tag_and_children");
  const [deleteMoveTo, setDeleteMoveTo] = useState("__none__");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tags?in_my_words=1");
      if (res.ok) setTree(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const selected = flat.find((t) => t.id === selectedId) ?? null;

  const openCreate = (parentId?: string) => {
    setNewName("");
    setNewParentId(parentId ?? "__root__");
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parent_id: newParentId === "__root__" ? null : newParentId,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Could not create tag");
      return;
    }
    toast.success("Tag created");
    setCreateOpen(false);
    await load();
  };

  const handleRename = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/tags/${selectedId}`, {
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

  const handleMove = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/tags/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_id: moveParentId === "__root__" ? null : moveParentId,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Could not move tag");
      return;
    }
    toast.success("Tag moved");
    setMoveOpen(false);
    await load();
  };

  const handleMerge = async () => {
    if (!selectedId || !mergeTargetId) return;
    const res = await fetch(`/api/tags/${selectedId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_tag_id: mergeTargetId }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Could not merge tags");
      return;
    }
    toast.success("Tags merged");
    setMergeOpen(false);
    setSelectedId(mergeTargetId);
    await load();
  };

  const openDelete = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/tags/${selectedId}?preview=1`);
    if (!res.ok) {
      toast.error("Could not load tag info");
      return;
    }
    const preview = await res.json();
    setDeletePreview(preview);
    setDeleteMode(
      preview.can_delete_only ? "tag_only" : "tag_and_children"
    );
    setDeleteMoveTo("__none__");
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const params = new URLSearchParams({ mode: deleteMode });
    if (deleteMode === "move_vocab" && deleteMoveTo !== "__none__") {
      params.set("move_to", deleteMoveTo);
    }
    const res = await fetch(`/api/tags/${selectedId}?${params}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Could not delete tag");
      return;
    }
    toast.success("Tag deleted");
    setDeleteOpen(false);
    setSelectedId(null);
    await load();
  };

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              All top-level tags appear side by side. Expand a branch to drill
              into sub-tags, or use search to jump to a match.
            </p>
          </div>
          <Button size="sm" onClick={() => openCreate()} className="shrink-0">
            <Plus className="size-4 mr-1" />
            New tag
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading tags…</p>
        ) : (
          <TagForest
            tree={tree}
            search={search}
            onSearchChange={setSearch}
            activeId={selectedId}
            onNodeClick={(id) => setSelectedId(id)}
            showCounts
          />
        )}

        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          {selected ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Selected tag
                  </p>
                  <p className="font-semibold text-base break-words">{selected.path}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {selected.word_count} saved{" "}
                    {selected.word_count === 1 ? "item" : "items"}
                  </p>
                </div>
                <Link
                  href={`/words?tag_id=${encodeURIComponent(selected.id)}&in_my_words=1`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                >
                  View in My collections
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenameValue(selected.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="size-3.5 mr-1" />
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMoveParentId(selected.parent_id ?? "__root__");
                    setMoveOpen(true);
                  }}
                >
                  <FolderTree className="size-3.5 mr-1" />
                  Move
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMergeTargetId("");
                    setMergeOpen(true);
                  }}
                >
                  <GitMerge className="size-3.5 mr-1" />
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openCreate(selected.id)}
                >
                  <Plus className="size-3.5 mr-1" />
                  Add child
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void openDelete()}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click any tag above to rename, move, merge, or delete it.
            </p>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tag name"
            />
            <Select value={newParentId} onValueChange={(v) => v && setNewParentId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Parent" />
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
          </div>
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
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => void handleRename()} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move tag</DialogTitle>
            <DialogDescription>
              Change where <span className="font-medium">{selected?.name}</span> lives in the tree.
            </DialogDescription>
          </DialogHeader>
          <Select value={moveParentId} onValueChange={(v) => v && setMoveParentId(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Top level</SelectItem>
              {flat
                .filter((t) => t.id !== selectedId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.path}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={() => void handleMove()}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into another tag</DialogTitle>
            <DialogDescription>
              All vocabulary tagged with{" "}
              <span className="font-medium">{selected?.path}</span> will also get
              the target tag. Child tags become children of the target.
            </DialogDescription>
          </DialogHeader>
          <Select value={mergeTargetId} onValueChange={(v) => v && setMergeTargetId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Target tag" />
            </SelectTrigger>
            <SelectContent>
              {flat
                .filter((t) => t.id !== selectedId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.path}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={() => void handleMerge()} disabled={!mergeTargetId}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              {deletePreview ? (
                <>
                  Delete <span className="font-medium">{deletePreview.path}</span>?
                  {deletePreview.child_count > 0 && (
                    <> It has {deletePreview.child_count} child tag(s).</>
                  )}
                  {deletePreview.word_count > 0 && (
                    <> {deletePreview.word_count} vocabulary item(s) use this tag.</>
                  )}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {!deletePreview?.can_delete_only && (
            <div className="space-y-2">
              <Select
                value={deleteMode}
                onValueChange={(v) =>
                  v &&
                  setDeleteMode(
                    v as "tag_only" | "tag_and_children" | "move_vocab"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag_and_children">
                    Delete tag and all child tags
                  </SelectItem>
                  <SelectItem value="move_vocab">
                    Move vocabulary to another tag, then delete
                  </SelectItem>
                </SelectContent>
              </Select>
              {deleteMode === "move_vocab" && (
                <Select
                  value={deleteMoveTo}
                  onValueChange={(v) => v && setDeleteMoveTo(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Move vocabulary to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {flat
                      .filter((t) => t.id !== selectedId)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.path}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
