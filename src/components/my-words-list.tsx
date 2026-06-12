"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  X,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MyWordsFilters,
  type StatusFilter,
} from "@/components/my-words-filters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { WordWithProgress } from "@/lib/types";
import { invalidateClientReviewQueue } from "@/lib/review-queue-sync";
import { type FrequencyBand, type WordSort } from "@/lib/frequency-rank";
import {
  type DateAddedFilter,
} from "@/lib/date-added-filter";
import { type EntryTypeFilter } from "@/lib/word-entry";
import { MyWordListCard } from "@/components/my-word-list-card";
import type { TagWithCount } from "@/lib/tags";

export function MyWordsList({
  variant = "page",
  selectedWordId,
}: {
  variant?: "page" | "sidebar";
  selectedWordId?: string;
}) {
  const isSidebar = variant === "sidebar";
  const router = useRouter();
  const listScrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const browseTagRaw = searchParams.get("tag_id");
  const browseTag =
    browseTagRaw && browseTagRaw.trim() !== "" ? browseTagRaw.trim() : null;
  const inMyWordsFromUrl =
    searchParams.get("in_my_words") === "1" ||
    searchParams.get("in_my_words") === "true";
  const browseCorpusByTag = browseTag !== null && !inMyWordsFromUrl;

  const [words, setWords] = useState<WordWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [entryTypeFilter, setEntryTypeFilter] =
    useState<EntryTypeFilter>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyBand>("all");
  const [dateAddedFilter, setDateAddedFilter] =
    useState<DateAddedFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>(browseTag ?? "all");
  const [sortBy, setSortBy] = useState<WordSort>("added");

  useEffect(() => {
    setSortBy(browseCorpusByTag ? "frequency" : "added");
  }, [browseCorpusByTag]);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const limit = 20;
  /* Expressions are not in CoCA — hide CoCA frequency. */
  const expressionsOnly = entryTypeFilter === "expression";

  useEffect(() => {
    if (entryTypeFilter !== "expression") return;
    setFrequencyFilter((f) => (f !== "all" ? "all" : f));
    setSortBy((s) => (s === "frequency" ? "added" : s));
  }, [entryTypeFilter]);

  /** Bulk-select mode: per-card checkboxes + sticky action bar. */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WordWithProgress | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const fetchWords = useCallback(
    async (pageNum: number) => {
      const gen = ++fetchGenRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(limit),
        });
        if (search) params.set("q", search);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (entryTypeFilter !== "all") {
          params.set("entry_type", entryTypeFilter);
        }
        if (!expressionsOnly && frequencyFilter !== "all") {
          params.set("frequency", frequencyFilter);
        }
        const activeTag = browseTag ?? tagFilter;
        if (activeTag && activeTag !== "all") {
          params.set("tag_id", activeTag);
        }
        params.set("sort", sortBy);
        if (!browseCorpusByTag) {
          params.set("in_my_words", "1");
          if (dateAddedFilter !== "all") {
            params.set("date_added", dateAddedFilter);
          }
        }
        const res = await fetch(`/api/words?${params}`);
        if (gen !== fetchGenRef.current) return;
        if (res.ok) {
          const json = await res.json();
          const fetched = Array.isArray(json)
            ? json
            : (json.data ?? json.words ?? []);
          setWords(fetched);
          const pagination = json?.pagination;
          if (pagination) {
            if (typeof pagination.total === "number") {
              setFilteredTotal(pagination.total);
            }
            if (typeof pagination.total_pages === "number") {
              setTotalPages(Math.max(1, pagination.total_pages));
            }
          }
        } else {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(err.error ?? "Could not load your words");
        }
      } catch {
        toast.error("Could not load your words");
      } finally {
        if (gen === fetchGenRef.current) setLoading(false);
      }
    },
    [
      search,
      statusFilter,
      entryTypeFilter,
      frequencyFilter,
      dateAddedFilter,
      expressionsOnly,
      tagFilter,
      sortBy,
      browseTag,
      browseCorpusByTag,
    ]
  );

  useEffect(() => {
    if (browseTag) setTagFilter(browseTag);
  }, [browseTag]);

  useEffect(() => {
    if (browseCorpusByTag) return;
    async function loadTags() {
      try {
        const res = await fetch("/api/tags?in_my_words=1");
        if (res.ok) setTags(await res.json());
      } catch {
        // ignore
      }
    }
    loadTags();
  }, [browseCorpusByTag]);

  const skipPageFetchRef = useRef(false);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    skipPageFetchRef.current = true;
    setPage(1);
    setSelectedIds(new Set());
    void fetchWords(1);
  }, [
    search,
    statusFilter,
    entryTypeFilter,
    frequencyFilter,
    dateAddedFilter,
    tagFilter,
    sortBy,
    browseTag,
    browseCorpusByTag,
    fetchWords,
  ]);

  useEffect(() => {
    if (skipPageFetchRef.current) {
      skipPageFetchRef.current = false;
      return;
    }
    void fetchWords(page);
  }, [page, fetchWords]);

  const goToPage = useCallback(
    (next: number) => {
      if (next < 1 || next > totalPages || next === page) return;
      setPage(next);
      const scrollEl = isSidebar ? listScrollRef.current : null;
      if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [page, totalPages, isSidebar]
  );

  const pageRangeStart =
    filteredTotal === 0 ? 0 : (page - 1) * limit + 1;
  const pageRangeEnd = Math.min(page * limit, filteredTotal);

  const filterParamsForBulk = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (entryTypeFilter !== "all") p.set("entry_type", entryTypeFilter);
    if (!expressionsOnly && frequencyFilter !== "all") {
      p.set("frequency", frequencyFilter);
    }
    const activeTag = browseTag ?? tagFilter;
    if (activeTag && activeTag !== "all") {
      p.set("tag_id", activeTag);
    }
    if (!browseCorpusByTag) {
      p.set("in_my_words", "1");
      if (dateAddedFilter !== "all") p.set("date_added", dateAddedFilter);
    }
    return p;
  }, [
    search,
    statusFilter,
    entryTypeFilter,
    frequencyFilter,
    dateAddedFilter,
    expressionsOnly,
    tagFilter,
    browseTag,
    browseCorpusByTag,
  ]);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const w of words) next.add(w.id);
      return next;
    });
  }, [words]);

  const selectAllFiltered = useCallback(async () => {
    if (browseCorpusByTag) return;
    setSelectingAll(true);
    try {
      const params = new URLSearchParams(filterParamsForBulk);
      params.set("ids_only", "1");
      const res = await fetch(`/api/words?${params}`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { ids?: string[] };
      const ids = Array.isArray(json.ids) ? json.ids : [];
      setSelectedIds(new Set(ids));
      toast.success(`Selected ${ids.length} word${ids.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not load full selection");
    } finally {
      setSelectingAll(false);
    }
  }, [browseCorpusByTag, filterParamsForBulk]);

  const confirmBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const res = await fetch("/api/progress/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_ids: ids }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Bulk remove failed");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        removed?: number;
        excluded_saved?: boolean;
        exclusion_error?: string;
      };
      const removed = json.removed ?? ids.length;
      const removedSet = new Set(ids);
      const remaining = words.filter((w) => !removedSet.has(w.id));
      if (remaining.length === 0 && page > 1) {
        setPage(page - 1);
      } else {
        setWords(remaining);
        setFilteredTotal((t) => Math.max(0, t - removed));
      }
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkDeleteOpen(false);
      invalidateClientReviewQueue();
      toast.success(
        `Removed ${removed} word${removed === 1 ? "" : "s"} from your list`
      );
      if (json.excluded_saved === false) {
        toast.warning(
          "Review queue exclusions could not be saved — run excluded_from_review migration in Supabase, or reopen Review to refresh.",
          { duration: 8000 }
        );
      }
    } catch {
      toast.error("Bulk remove failed");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, bulkDeleting, words, page]);

  const handleRemove = async (w: WordWithProgress) => {
    try {
      if (w.is_custom) {
        const res = await fetch(`/api/words/${w.id}`, { method: "DELETE" });
        if (res.ok) {
          const remaining = words.filter((x) => x.id !== w.id);
          if (remaining.length === 0 && page > 1) {
            setPage(page - 1);
          } else {
            setWords(remaining);
            setFilteredTotal((t) => Math.max(0, t - 1));
          }
          invalidateClientReviewQueue();
          toast.success("Word removed");
          if (w.id === selectedWordId) router.push("/words");
          return true;
        }
        toast.error("Failed to remove word");
        return false;
      }
      const res = await fetch("/api/progress/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_id: w.id }),
      });
      if (res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          excluded_saved?: boolean;
          exclusion_error?: string;
        };
        const remaining = words.filter((x) => x.id !== w.id);
        if (remaining.length === 0 && page > 1) {
          setPage(page - 1);
        } else {
          setWords(remaining);
          setFilteredTotal((t) => Math.max(0, t - 1));
        }
        invalidateClientReviewQueue();
        if (j.excluded_saved === false) {
          toast.warning(
            `Removed, but exclusions did not persist (${j.exclusion_error ?? 'see server logs'}). Run Supabase migration for excluded_from_review.`,
            { duration: 8000 }
          );
        } else toast.success("Removed from your words");
        if (w.id === selectedWordId) router.push("/words");
        return true;
      }
      toast.error("Failed to remove from collection");
      return false;
    } catch {
      toast.error("Failed to remove");
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const ok = await handleRemove(deleteTarget);
    setDeleting(false);
    if (ok) setDeleteTarget(null);
  };

  const canBulkSelect = !browseCorpusByTag;

  const activeTagLabel = useMemo(() => {
    const id = browseTag ?? (tagFilter !== "all" ? tagFilter : null);
    if (!id) return null;
    return tags.find((t) => t.id === id)?.name ?? null;
  }, [browseTag, tagFilter, tags]);
  const allOnPageSelected =
    words.length > 0 && words.every((w) => selectedIds.has(w.id));
  const selectedCount = selectedIds.size;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        !isSidebar && "w-full"
      )}
    >
      <div
        ref={listScrollRef}
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain",
          isSidebar
            ? "px-3 py-4 pb-4"
            : "mx-auto w-full max-w-4xl px-4 py-6 pb-28 md:px-8 md:py-8"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              className={cn(
                "font-bold tracking-tight",
                isSidebar ? "text-lg" : "text-2xl"
              )}
            >
              {activeTagLabel ? `Tag: ${activeTagLabel}` : "My collections"}
            </h1>
            {!browseCorpusByTag && (
              <p className="text-xs text-muted-foreground mt-1">
                {activeTagLabel
                  ? `Saved items tagged with “${activeTagLabel}”.`
                  : "Words you have added to your book (not the full dictionary)."}
              </p>
            )}
            {browseCorpusByTag && (
              <p className="text-xs text-muted-foreground mt-1">
                Full word bank for this tag (includes words you have not
                added to My collections).
              </p>
            )}
          </div>
          {canBulkSelect && words.length > 0 && !selectMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={enterSelectMode}
            >
              <CheckSquare className="size-4 mr-1.5" />
              Select
            </Button>
          )}
          {canBulkSelect && selectMode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={exitSelectMode}
            >
              <X className="size-4 mr-1.5" />
              Done
            </Button>
          )}
        </div>

        <MyWordsFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          entryTypeFilter={entryTypeFilter}
          onEntryTypeFilterChange={setEntryTypeFilter}
          frequencyFilter={frequencyFilter}
          onFrequencyFilterChange={setFrequencyFilter}
          hideFrequencyFilter={expressionsOnly}
          showDateAddedFilter={!browseCorpusByTag}
          dateAddedFilter={dateAddedFilter}
          onDateAddedFilterChange={setDateAddedFilter}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          defaultSort={browseCorpusByTag ? "frequency" : "added"}
          tags={tags}
          tagLocked={!!browseTag}
          searchPlaceholder={
            browseCorpusByTag
              ? "Search in this tag…"
              : activeTagLabel
                ? "Search your saved words…"
                : "Search your words…"
          }
        />

        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">
            Loading words...
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-muted-foreground">No words found</p>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                <X className="size-4 mr-1" /> Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {words.map((word) => (
              <MyWordListCard
                key={word.id}
                word={word}
                active={word.id === selectedWordId}
                onClick={
                  selectMode && canBulkSelect
                    ? undefined
                    : () => router.push(`/words/${word.id}`)
                }
                selectable={selectMode && canBulkSelect}
                selected={selectedIds.has(word.id)}
                onToggleSelect={() => toggleSelect(word.id)}
                actions={
                  selectMode ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 shrink-0"
                            aria-label="Word options"
                          />
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(word);
                          }}
                        >
                          <Trash2 className="size-4" />
                          {word.is_custom ? "Delete" : "Remove"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }
              />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 flex-nowrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {pageRangeStart}–{pageRangeEnd} of {filteredTotal} · Page {page}{" "}
                  of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectMode && canBulkSelect && (
        <div
          className={cn(
            "z-40 shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            isSidebar
              ? "px-3 py-2"
              : "fixed inset-x-0 bottom-14 pb-[env(safe-area-inset-bottom)] md:bottom-0"
          )}
          role="region"
          aria-label="Bulk selection actions"
        >
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
              !isSidebar && "mx-auto max-w-4xl px-4 py-2.5 md:px-8"
            )}
          >
            <span className="text-sm font-medium mr-auto">
              {selectedCount} selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={allOnPageSelected ? () => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const w of words) next.delete(w.id);
                  return next;
                });
              } : selectAllOnPage}
              disabled={words.length === 0}
            >
              {allOnPageSelected ? "Clear page" : `Select page (${words.length})`}
            </Button>
            {filteredTotal > words.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void selectAllFiltered()}
                disabled={selectingAll}
              >
                {selectingAll ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : null}
                Select all ({filteredTotal})
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedCount === 0}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4 mr-1.5" />
              Delete{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !bulkDeleting) setBulkDeleteOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!bulkDeleting}>
          <DialogHeader>
            <DialogTitle>
              Remove {selectedCount} word{selectedCount === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              The selected words will be removed from your study list. You can
              add them again later from Add Word.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkDeleting || selectedCount === 0}
              onClick={() => void confirmBulkDelete()}
            >
              {bulkDeleting ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Removing…
                </>
              ) : (
                `Remove ${selectedCount}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.is_custom ? "Delete word?" : "Remove?"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.is_custom
                ? `“${deleteTarget.word}” will be deleted permanently. This cannot be undone.`
                : `“${deleteTarget?.word}” will be removed from your study list. You can add it again later from Search.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Removing…" : deleteTarget?.is_custom ? "Delete" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
