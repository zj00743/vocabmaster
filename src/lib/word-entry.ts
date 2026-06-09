/**
 * Entry type. `word` / `phrase` are auto-detectable from whitespace, but
 * `sentence_pattern` cannot be (it is also multi-word), so it must be stored
 * explicitly on the row (`words.entry_type`).
 */
export type EntryType = "word" | "phrase" | "sentence_pattern";

export type EntryTypeFilter = "all" | EntryType;

export const ENTRY_TYPE_FILTER_OPTIONS: {
  value: EntryTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "All types" },
  { value: "word", label: "Words only" },
  { value: "phrase", label: "Phrases only" },
  { value: "sentence_pattern", label: "Sentence patterns" },
];

export function isPhraseEntry(text: string): boolean {
  return /\s/.test(text.trim());
}

/** Valid stored values for `words.entry_type`. */
export function isStoredEntryType(v: unknown): v is EntryType {
  return v === "word" || v === "phrase" || v === "sentence_pattern";
}

/**
 * Resolve the effective type of an entry. Prefer the explicitly stored
 * `entry_type`; fall back to whitespace detection for legacy rows where it is
 * still null (word vs phrase only — sentence patterns must be stored).
 */
export function resolveEntryType(
  text: string,
  stored?: string | null
): EntryType {
  if (isStoredEntryType(stored)) return stored;
  return isPhraseEntry(text) ? "phrase" : "word";
}

/** Value to persist when no explicit type is chosen (CoCA import, AI add). */
export function deriveStoredEntryType(text: string): Exclude<
  EntryType,
  "sentence_pattern"
> {
  return isPhraseEntry(text) ? "phrase" : "word";
}

/** Short badge label for an entry type. */
export function entryTypeBadgeLabel(type: EntryType): string {
  switch (type) {
    case "sentence_pattern":
      return "Sentence pattern";
    case "phrase":
      return "Phrase";
    default:
      return "Word";
  }
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
  return entryTypeBadgeLabel(type);
}

/** CoCA import rows have a numeric rank; custom / manual entries do not. */
export function isInCocaBank(rank: number | null | undefined): boolean {
  return rank != null && Number.isFinite(rank);
}

export function isValidEntryTypeFilter(v: string): v is EntryTypeFilter {
  return ENTRY_TYPE_FILTER_OPTIONS.some((o) => o.value === v);
}

/**
 * PostgREST filter on the stored `entry_type` column (backfilled for all rows
 * by supabase-migration-entry-type.sql, and set on every insert).
 */
export function applyEntryTypeFilter<
  Q extends {
    eq: (col: string, val: string) => Q;
  },
>(query: Q, entryType: EntryTypeFilter, entryTypeColumn: string): Q {
  if (entryType === "all") return query;
  return query.eq(entryTypeColumn, entryType);
}
