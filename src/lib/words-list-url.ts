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
