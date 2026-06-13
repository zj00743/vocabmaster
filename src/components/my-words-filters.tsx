"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, ArrowUpDown, Check, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FrequencyBand,
  type WordSort,
  FREQUENCY_BAND_OPTIONS,
  WORD_SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from "@/lib/frequency-rank";
import {
  type DateAddedFilter,
  DATE_ADDED_FILTER_OPTIONS,
} from "@/lib/date-added-filter";
import {
  type EntryTypeFilter,
  ENTRY_TYPE_FILTER_OPTIONS,
} from "@/lib/word-entry";
import type { TagWithCount } from "@/lib/tags";
import { cn } from "@/lib/utils";

export type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]["value"];

interface MyWordsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  entryTypeFilter: EntryTypeFilter;
  onEntryTypeFilterChange: (value: EntryTypeFilter) => void;
  frequencyFilter: FrequencyBand;
  onFrequencyFilterChange: (value: FrequencyBand) => void;
  hideFrequencyFilter?: boolean;
  showDateAddedFilter?: boolean;
  dateAddedFilter?: DateAddedFilter;
  onDateAddedFilterChange?: (value: DateAddedFilter) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  sortBy: WordSort;
  onSortByChange: (value: WordSort) => void;
  defaultSort?: WordSort;
  tags: TagWithCount[];
  tagLocked?: boolean;
  searchPlaceholder?: string;
}

function labelFor<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function MyWordsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  entryTypeFilter,
  onEntryTypeFilterChange,
  frequencyFilter,
  onFrequencyFilterChange,
  hideFrequencyFilter = false,
  showDateAddedFilter = false,
  dateAddedFilter = "all",
  onDateAddedFilterChange,
  tagFilter,
  onTagFilterChange,
  sortBy,
  onSortByChange,
  defaultSort = "frequency",
  tags,
  tagLocked = false,
  searchPlaceholder = "Search your words…",
}: MyWordsFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const sortOptions = hideFrequencyFilter
    ? WORD_SORT_OPTIONS.filter((o) => o.value !== "frequency")
    : WORD_SORT_OPTIONS;

  const activeTag = useMemo(
    () => tags.find((t) => t.id === tagFilter) ?? null,
    [tags, tagFilter]
  );

  const hasActiveFilters =
    statusFilter !== "all" ||
    entryTypeFilter !== "all" ||
    (!hideFrequencyFilter && frequencyFilter !== "all") ||
    (showDateAddedFilter && dateAddedFilter !== "all") ||
    tagFilter !== "all";

  const hasNonDefaultSort = sortBy !== defaultSort;

  const clearFilters = () => {
    onStatusFilterChange("all");
    onEntryTypeFilterChange("all");
    onFrequencyFilterChange("all");
    onDateAddedFilterChange?.("all");
    onTagFilterChange("all");
  };

  const toggleFilters = () => {
    setShowFilters((v) => !v);
    setShowSort(false);
  };

  const toggleSort = () => {
    setShowSort((v) => !v);
    setShowFilters(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10 h-10 rounded-xl bg-background"
          />
        </div>
        <ToolbarIconButton
          icon={Filter}
          label="Filters"
          active={showFilters}
          highlighted={hasActiveFilters}
          onClick={toggleFilters}
        />
        <ToolbarIconButton
          icon={ArrowUpDown}
          label="Sort"
          active={showSort}
          highlighted={hasNonDefaultSort}
          onClick={toggleSort}
        />
      </div>

      {showFilters && (
        <div className="@container rounded-xl border bg-muted/30 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
            <FilterField label="Status">
              <Select
                value={statusFilter}
                onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
              >
                <SelectTrigger className="w-full h-9 rounded-lg bg-background">
                  <SelectValue>
                    {labelFor(STATUS_FILTER_OPTIONS, statusFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  side="bottom"
                  sideOffset={4}
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Type">
              <Select
                value={entryTypeFilter}
                onValueChange={(v) =>
                  onEntryTypeFilterChange(v as EntryTypeFilter)
                }
              >
                <SelectTrigger className="w-full h-9 rounded-lg bg-background">
                  <SelectValue>
                    {labelFor(ENTRY_TYPE_FILTER_OPTIONS, entryTypeFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  side="bottom"
                  sideOffset={4}
                >
                  {ENTRY_TYPE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {showDateAddedFilter && onDateAddedFilterChange && (
              <FilterField label="Date added">
                <Select
                  value={dateAddedFilter}
                  onValueChange={(v) =>
                    onDateAddedFilterChange(v as DateAddedFilter)
                  }
                >
                  <SelectTrigger className="w-full h-9 rounded-lg bg-background">
                    <SelectValue>
                      {labelFor(DATE_ADDED_FILTER_OPTIONS, dateAddedFilter)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    sideOffset={4}
                  >
                    {DATE_ADDED_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            )}

            {!hideFrequencyFilter && (
              <FilterField label="CoCA ranking">
                <Select
                  value={frequencyFilter}
                  onValueChange={(v) =>
                    onFrequencyFilterChange(v as FrequencyBand)
                  }
                >
                  <SelectTrigger className="w-full h-9 rounded-lg bg-background">
                    <SelectValue>
                      {labelFor(FREQUENCY_BAND_OPTIONS, frequencyFilter)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    sideOffset={4}
                  >
                    {FREQUENCY_BAND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            )}

            <FilterField label="Tag">
              <Select
                value={tagFilter}
                onValueChange={(v) => v && onTagFilterChange(v)}
                disabled={tagLocked}
              >
                <SelectTrigger
                  className={cn(
                    "w-full h-9 rounded-lg bg-background",
                    tagLocked && "opacity-70"
                  )}
                >
                  <SelectValue>
                    {tagFilter === "all"
                      ? "All tags"
                      : (activeTag?.name ?? "Tag")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  side="bottom"
                  sideOffset={4}
                >
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.word_count > 0 ? ` (${t.word_count})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </div>
        </div>
      )}

      {showSort && (
        <div className="rounded-xl border bg-muted/30 p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="px-1.5 pb-1 text-xs text-muted-foreground">Sort by</p>
          <div className="flex flex-col gap-0.5">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSortByChange(opt.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-background/80",
                  sortBy === opt.value && "bg-background font-medium shadow-sm"
                )}
              >
                <span>{opt.label}</span>
                {sortBy === opt.value && (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasActiveFilters && !showFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusFilter !== "all" && (
            <FilterChip
              label={labelFor(STATUS_FILTER_OPTIONS, statusFilter)}
              onClear={() => onStatusFilterChange("all")}
            />
          )}
          {entryTypeFilter !== "all" && (
            <FilterChip
              label={labelFor(ENTRY_TYPE_FILTER_OPTIONS, entryTypeFilter)}
              onClear={() => onEntryTypeFilterChange("all")}
            />
          )}
          {!hideFrequencyFilter && frequencyFilter !== "all" && (
            <FilterChip
              label={labelFor(FREQUENCY_BAND_OPTIONS, frequencyFilter)}
              onClear={() => onFrequencyFilterChange("all")}
            />
          )}
          {showDateAddedFilter && dateAddedFilter !== "all" && (
            <FilterChip
              label={labelFor(DATE_ADDED_FILTER_OPTIONS, dateAddedFilter)}
              onClear={() => onDateAddedFilterChange?.("all")}
            />
          )}
          {tagFilter !== "all" && activeTag && (
            <FilterChip
              label={activeTag.name}
              onClear={() => onTagFilterChange("all")}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

function ToolbarIconButton({
  icon: Icon,
  label,
  active,
  highlighted,
  onClick,
}: {
  icon: typeof Filter;
  label: string;
  active: boolean;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "size-10 shrink-0 rounded-xl relative",
        active && "bg-muted border-primary/30",
        highlighted && !active && "border-primary/40"
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className="size-4" />
      {highlighted && !active && (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
      )}
    </Button>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <span className="text-xs text-muted-foreground px-0.5">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background pl-2 pr-1 py-0.5 text-[11px]">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-muted text-muted-foreground"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
