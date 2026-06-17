import {
  isValidFrequencyBand,
  isValidWordSort,
  STATUS_FILTER_OPTIONS,
  type FrequencyBand,
  type WordSort,
} from "@/lib/frequency-rank";
import { isValidDateAddedFilter, type DateAddedFilter } from "@/lib/date-added-filter";
import {
  isValidEntryTypeFilter,
  type EntryTypeFilter,
} from "@/lib/word-entry";

/** List filter query keys preserved when opening a word card or returning to the list. */
const WORDS_LIST_QUERY_KEYS = [
  "tag_id",
  "in_my_words",
  "q",
  "status",
  "entry_type",
  "frequency",
  "date_added",
  "sort",
  "page",
] as const;

type SearchParamsLike = {
  get(name: string): string | null;
};

export type WordsListFilterState = {
  search: string;
  statusFilter: (typeof STATUS_FILTER_OPTIONS)[number]["value"];
  entryTypeFilter: EntryTypeFilter;
  frequencyFilter: FrequencyBand;
  dateAddedFilter: DateAddedFilter;
  tagFilter: string;
  sortBy: WordSort;
  page: number;
};

function isValidStatusFilter(
  v: string
): v is WordsListFilterState["statusFilter"] {
  return STATUS_FILTER_OPTIONS.some((o) => o.value === v);
}

export function wordsListQueryFromSearchParams(
  searchParams: SearchParamsLike
): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of WORDS_LIST_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) out.set(key, value);
  }
  return out;
}

export function wordsListQueryKey(searchParams: SearchParamsLike): string {
  return wordsListQueryFromSearchParams(searchParams).toString();
}

/** Stable query string for comparing or storing list state (fixed key order). */
export function canonicalWordsListQueryString(
  query: URLSearchParams
): string {
  const out = new URLSearchParams();
  for (const key of WORDS_LIST_QUERY_KEYS) {
    const value = query.get(key);
    if (value) out.set(key, value);
  }
  return out.toString();
}

/** Compare list-filter queries ignoring param order. */
export function wordsListQueriesEqual(
  query: URLSearchParams,
  searchParams: SearchParamsLike
): boolean {
  const fromUrl = wordsListQueryFromSearchParams(searchParams);
  for (const key of WORDS_LIST_QUERY_KEYS) {
    if ((query.get(key) ?? "") !== (fromUrl.get(key) ?? "")) return false;
  }
  return true;
}

export function parseWordsListStateFromSearchParams(
  searchParams: SearchParamsLike,
  defaultSort: WordSort
): WordsListFilterState {
  const status = searchParams.get("status");
  const entryType = searchParams.get("entry_type");
  const frequency = searchParams.get("frequency");
  const dateAdded = searchParams.get("date_added");
  const sort = searchParams.get("sort");
  const tagId = searchParams.get("tag_id");
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);

  return {
    search: searchParams.get("q") ?? "",
    statusFilter:
      status && isValidStatusFilter(status) ? status : "all",
    entryTypeFilter:
      entryType && isValidEntryTypeFilter(entryType) ? entryType : "all",
    frequencyFilter:
      frequency && isValidFrequencyBand(frequency) ? frequency : "all",
    dateAddedFilter:
      dateAdded && isValidDateAddedFilter(dateAdded) ? dateAdded : "all",
    tagFilter: tagId && tagId.trim() !== "" ? tagId.trim() : "all",
    sortBy: sort && isValidWordSort(sort) ? sort : defaultSort,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export type BuildWordsListQueryInput = {
  search: string;
  statusFilter: WordsListFilterState["statusFilter"];
  entryTypeFilter: EntryTypeFilter;
  frequencyFilter: FrequencyBand;
  dateAddedFilter: DateAddedFilter;
  tagFilter: string;
  browseTag: string | null;
  sortBy: WordSort;
  page: number;
  browseCorpusByTag: boolean;
  expressionsOnly: boolean;
};

export function buildWordsListQuery(
  input: BuildWordsListQueryInput
): URLSearchParams {
  const p = new URLSearchParams();
  if (input.search) p.set("q", input.search);
  if (input.statusFilter !== "all") p.set("status", input.statusFilter);
  if (input.entryTypeFilter !== "all") {
    p.set("entry_type", input.entryTypeFilter);
  }
  if (!input.expressionsOnly && input.frequencyFilter !== "all") {
    p.set("frequency", input.frequencyFilter);
  }
  const activeTag = input.browseCorpusByTag
    ? input.browseTag
    : input.tagFilter !== "all"
      ? input.tagFilter
      : null;
  if (activeTag) {
    p.set("tag_id", activeTag);
  }
  p.set("sort", input.sortBy);
  if (!input.browseCorpusByTag) {
    p.set("in_my_words", "1");
    if (input.dateAddedFilter !== "all") {
      p.set("date_added", input.dateAddedFilter);
    }
  }
  if (input.page > 1) p.set("page", String(input.page));
  return p;
}

export function wordsListHref(query?: URLSearchParams): string {
  const qs = query?.toString() ?? "";
  return qs ? `/words?${qs}` : "/words";
}

export function wordDetailHref(
  wordId: string,
  listQuery: URLSearchParams,
  options?: { tab?: "front" | "back" | "memory-curve" }
): string {
  const q = new URLSearchParams(listQuery);
  if (options?.tab) q.set("tab", options.tab);
  const qs = q.toString();
  return qs ? `/words/${wordId}?${qs}` : `/words/${wordId}`;
}

export function wordEditHref(
  wordId: string,
  section: string,
  listQuery: URLSearchParams
): string {
  const q = new URLSearchParams(listQuery);
  const qs = q.toString();
  return qs
    ? `/words/${wordId}/edit/${section}?${qs}`
    : `/words/${wordId}/edit/${section}`;
}
