/**
 * Entry type. `word` is single-token; `expression` covers multi-word phrases and
 * sentence patterns (stored explicitly on `words.entry_type` when not
 * inferable from whitespace alone).
 */
export type EntryType = "word" | "expression";

export type EntryTypeFilter = "all" | EntryType;

export const ENTRY_TYPE_FILTER_OPTIONS: {
  value: EntryTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "All types" },
  { value: "word", label: "Words only" },
  { value: "expression", label: "Expressions only" },
];

/** True when the lemma has multiple space-separated tokens. */
export function isPhraseEntry(text: string): boolean {
  return /\s/.test(text.trim());
}

/** Alias for multi-word lemmas (phrases, sentence patterns, etc.). */
export const isExpressionEntry = isPhraseEntry;

/** Valid stored values for `words.entry_type`. */
export function isStoredEntryType(v: unknown): v is EntryType {
  return v === "word" || v === "expression";
}

/** Legacy DB / API values merged into `expression`. */
export function isLegacyExpressionType(v: unknown): boolean {
  return v === "phrase" || v === "sentence_pattern";
}

/**
 * Resolve the effective type of an entry. Prefer the explicitly stored
 * `entry_type`; fall back to whitespace detection for legacy rows where it is
 * still null.
 */
export function resolveEntryType(
  text: string,
  stored?: string | null
): EntryType {
  if (stored === "phrase" || stored === "sentence_pattern" || stored === "expression") {
    return "expression";
  }
  if (stored === "word") return "word";
  return isPhraseEntry(text) ? "expression" : "word";
}

/** Value to persist when no explicit type is chosen (CoCA import, AI add). */
export function deriveStoredEntryType(text: string): EntryType {
  return isPhraseEntry(text) ? "expression" : "word";
}

/** Normalize API / legacy stored values to the current schema. */
export function normalizeEntryTypeForStorage(
  v: unknown,
  text = ""
): EntryType {
  if (v === "word") return "word";
  if (v === "expression" || isLegacyExpressionType(v)) return "expression";
  return deriveStoredEntryType(text);
}

/**
 * Whether the card image section is shown. An explicit per-card `show_image`
 * wins; otherwise images default on for words and off for expressions.
 */
export function resolveShowImage(
  text: string,
  entryTypeStored: string | null | undefined,
  showImage: boolean | null | undefined
): boolean {
  if (typeof showImage === "boolean") return showImage;
  return resolveEntryType(text, entryTypeStored) === "word";
}

/** Short badge label for an entry type. */
export function entryTypeBadgeLabel(type: EntryType): string {
  return type === "expression" ? "Expression" : "Word";
}

/** Space-separated tokens in an expression lemma. */
export function phraseWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Number of space-separated tokens in an expression lemma. */
export function phraseWordCount(text: string): number {
  return phraseWords(text).length;
}

/** Blank box width in `ch` per token (one slot for a word, one per word in an expression). */
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
  return isPhraseEntry(text) ? "expression" : "word";
}

export function entryTypeLabel(type: EntryType): string {
  return entryTypeBadgeLabel(type);
}

/** CoCA import rows have a numeric rank; custom / manual entries do not. */
export function isInCocaBank(rank: number | null | undefined): boolean {
  return rank != null && Number.isFinite(rank);
}

export function isValidEntryTypeFilter(v: string): v is EntryTypeFilter {
  if (v === "phrase" || v === "sentence_pattern") return true;
  return ENTRY_TYPE_FILTER_OPTIONS.some((o) => o.value === v);
}

/** Map filter param (incl. legacy values) to the current filter enum. */
export function normalizeEntryTypeFilter(v: string): EntryTypeFilter {
  if (v === "phrase" || v === "sentence_pattern" || v === "expression") {
    return "expression";
  }
  if (v === "word") return "word";
  return "all";
}

/**
 * PostgREST filter on the stored `entry_type` column (backfilled for all rows
 * by supabase-migration-entry-type.sql, and set on every insert).
 */
export function applyEntryTypeFilter<
  Q extends {
    eq: (col: string, val: string) => Q;
    in: (col: string, vals: string[]) => Q;
  },
>(query: Q, entryType: EntryTypeFilter, entryTypeColumn: string): Q {
  if (entryType === "all") return query;
  if (entryType === "expression") {
    return query.in(entryTypeColumn, [
      "expression",
      "phrase",
      "sentence_pattern",
    ]);
  }
  return query.eq(entryTypeColumn, entryType);
}
