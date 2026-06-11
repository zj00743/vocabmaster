"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TagTreeNode } from "@/lib/tags";
import { filterTagTree } from "@/lib/tags";

function collectExpandableIds(nodes: TagTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: TagTreeNode[]) => {
    for (const n of list) {
      if (n.children.length > 0) ids.push(n.id);
      walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

function ForestBranch({
  node,
  depth,
  expanded,
  onToggleExpanded,
  activeId,
  onNodeClick,
  showCounts,
  forceExpand,
}: {
  node: TagTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  activeId?: string | null;
  onNodeClick?: (id: string, path: string) => void;
  showCounts: boolean;
  forceExpand: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = forceExpand || expanded.has(node.id);
  const isActive = activeId === node.id;

  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-border/60 pl-2")}>
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md text-sm hover:bg-muted/50",
          isActive && "bg-primary/10 text-primary font-medium"
        )}
      >
        <button
          type="button"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-sm",
            !hasChildren && "invisible"
          )}
          onClick={() => onToggleExpanded(node.id)}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left"
          onClick={() => onNodeClick?.(node.id, node.path)}
        >
          <span className="truncate">{node.name}</span>
          {showCounts && node.word_count > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
              {node.word_count}
            </span>
          )}
        </button>
      </div>
      {hasChildren && isOpen && (
        <div className="space-y-0.5 pb-1">
          {node.children.map((child) => (
            <ForestBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              activeId={activeId}
              onNodeClick={onNodeClick}
              showCounts={showCounts}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RootTagColumn({
  root,
  expanded,
  onToggleExpanded,
  activeId,
  onNodeClick,
  showCounts,
  forceExpand,
}: {
  root: TagTreeNode;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  activeId?: string | null;
  onNodeClick?: (id: string, path: string) => void;
  showCounts: boolean;
  forceExpand: boolean;
}) {
  const isActive = activeId === root.id;
  return (
    <section
      className={cn(
        "flex min-h-[12rem] flex-col rounded-xl border bg-background shadow-sm",
        isActive && "ring-2 ring-primary/30"
      )}
    >
      <button
        type="button"
        onClick={() => onNodeClick?.(root.id, root.path)}
        className={cn(
          "flex w-full items-start justify-between gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
          isActive && "bg-primary/5"
        )}
      >
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">{root.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {root.children.length}{" "}
            {root.children.length === 1 ? "branch" : "branches"}
          </p>
        </div>
        {showCounts && root.word_count > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary">
            {root.word_count}
          </span>
        )}
      </button>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-[min(28rem,50vh)]">
        {root.children.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No sub-tags</p>
        ) : (
          root.children.map((child) => (
            <ForestBranch
              key={child.id}
              node={child}
              depth={0}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              activeId={activeId}
              onNodeClick={onNodeClick}
              showCounts={showCounts}
              forceExpand={forceExpand}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function TagForest({
  tree,
  search = "",
  onSearchChange,
  activeId,
  onNodeClick,
  showCounts = true,
  className,
}: {
  tree: TagTreeNode[];
  search?: string;
  onSearchChange?: (value: string) => void;
  activeId?: string | null;
  onNodeClick?: (id: string, path: string) => void;
  showCounts?: boolean;
  className?: string;
}) {
  const filtered = useMemo(() => filterTagTree(tree, search), [tree, search]);
  const searching = Boolean(search.trim());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(collectExpandableIds(filtered)));
  }, [filtered]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  /* When searching, auto-expand branches that contain matches. */
  useEffect(() => {
    if (!searching) return;
    setExpanded(new Set(collectExpandableIds(filtered)));
  }, [searching, filtered]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onSearchChange && (
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tags…"
            className="h-9 text-sm flex-1"
          />
        )}
        <div className="flex gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={expandAll}
          >
            Expand all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={collapseAll}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-0.5">
        All top-level tags are shown below. Expand a branch to see deeper tags.
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No tags found
        </p>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            filtered.length === 1 && "grid-cols-1",
            filtered.length === 2 && "grid-cols-1 sm:grid-cols-2",
            filtered.length >= 3 &&
              "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
          )}
        >
          {filtered.map((root) => (
            <RootTagColumn
              key={root.id}
              root={root}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              activeId={activeId}
              onNodeClick={onNodeClick}
              showCounts={showCounts}
              forceExpand={searching}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact check-mark tree for pickers (unchanged behavior). */
export function TagTreeCompact({
  tree,
  search = "",
  onSearchChange,
  selectedIds,
  onToggleSelect,
  activeId,
  onNodeClick,
  showCounts = true,
  multiSelect = false,
  className,
}: {
  tree: TagTreeNode[];
  search?: string;
  onSearchChange?: (value: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, path: string) => void;
  activeId?: string | null;
  onNodeClick?: (id: string, path: string) => void;
  showCounts?: boolean;
  multiSelect?: boolean;
  className?: string;
}) {
  const filtered = useMemo(() => filterTagTree(tree, search), [tree, search]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      {onSearchChange && (
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tags…"
          className="h-9 text-sm"
        />
      )}
      <div className="max-h-64 overflow-y-auto rounded-lg border bg-background p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No tags found</p>
        ) : (
          filtered.map((node) => (
            <CompactTreeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              activeId={activeId}
              onNodeClick={onNodeClick}
              showCounts={showCounts}
              multiSelect={multiSelect}
              forceExpand={Boolean(search.trim())}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CompactTreeRow({
  node,
  depth,
  expanded,
  onToggleExpanded,
  selectedIds,
  onToggleSelect,
  activeId,
  onNodeClick,
  showCounts,
  multiSelect,
  forceExpand,
}: {
  node: TagTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, path: string) => void;
  activeId?: string | null;
  onNodeClick?: (id: string, path: string) => void;
  showCounts: boolean;
  multiSelect: boolean;
  forceExpand: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = forceExpand || expanded.has(node.id);
  const isSelected = selectedIds?.has(node.id);
  const isActive = activeId === node.id;

  const handleRowClick = () => {
    if (multiSelect && onToggleSelect) {
      onToggleSelect(node.id, node.path);
      return;
    }
    onNodeClick?.(node.id, node.path);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-muted/60",
          isActive && "bg-primary/10 text-primary",
          isSelected && multiSelect && "bg-muted"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-sm",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded(node.id);
          }}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
          />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
          onClick={handleRowClick}
        >
          <span className="truncate">{node.name}</span>
          {showCounts && node.word_count > 0 && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {node.word_count}
            </span>
          )}
          {isSelected && multiSelect && (
            <Check className="ml-auto size-3.5 shrink-0 text-primary" />
          )}
        </button>
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <CompactTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              activeId={activeId}
              onNodeClick={onNodeClick}
              showCounts={showCounts}
              multiSelect={multiSelect}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
