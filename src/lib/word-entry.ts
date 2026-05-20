/** Single token vs multi-word entry (phrase). */
export type EntryType = "word" | "phrase";

export type EntryTypeFilter = "all" | EntryType;

export const ENTRY_TYPE_FILTER_OPTIONS: {
  value: EntryTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "All types" },
  { value: "word", label: "Words only" },
  { value: "phrase", label: "Phrases only" },
];

export function isPhraseEntry(text: string): boolean {
  return /\s/.test(text.trim());
}

/** Space-separated tokens in a phrase lemma. */
export function phraseWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Number of space-separated tokens in a phrase lemma. */
export function phraseWordCount(text: string): number {
  return phraseWords(text).length;
}

/** Blank box width in `ch` per token (one slot for a word, one per word in a phrase). */
export function entryBlankSlotChWidths(text: string): number[] {
  return phraseWords(text).map((w) =>
    Math.min(20, Math.max(5, w.length + 3))
  );
}

/** e.g. 4 words → "□ □ □ □" (text fallback) */
export function phraseBoxPlaceholder(text: string): string {
  const words = phraseWords(text);
  if (words.length === 0) return "□";
  return words.map(() => "□").join(" ");
}

export function entryTypeOf(text: string): EntryType {
  return isPhraseEntry(text) ? "phrase" : "word";
}

export function entryTypeLabel(type: EntryType): string {
  return type === "phrase" ? "Phrase" : "Word";
}

/** CoCA import rows have a numeric rank; custom / manual entries do not. */
export function isInCocaBank(rank: number | null | undefined): boolean {
  return rank != null && Number.isFinite(rank);
}

export function isValidEntryTypeFilter(v: string): v is EntryTypeFilter {
  return ENTRY_TYPE_FILTER_OPTIONS.some((o) => o.value === v);
}

/** PostgREST filter: phrase = lemma contains whitespace. */
export function applyEntryTypeFilter<
  Q extends {
    like: (col: string, pattern: string) => Q;
    not: (col: string, op: string, pattern: string) => Q;
  },
>(query: Q, entryType: EntryTypeFilter, wordColumn: string): Q {
  if (entryType === "phrase") return query.like(wordColumn, "% %");
  if (entryType === "word") return query.not(wordColumn, "like", "% %");
  return query;
}
