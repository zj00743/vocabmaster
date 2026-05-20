/** Escape a cell for RFC 4180-style CSV. */
export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function joinCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export function arrayToCsvField(value: unknown, separator = "|"): string {
  if (!Array.isArray(value)) return "";
  return value.map((x) => String(x).trim()).filter(Boolean).join(separator);
}

export const VOCAB_EXPORT_HEADERS = [
  "rank",
  "word",
  "part_of_speech",
  "category",
  "definition",
  "translation_zh",
  "ipa",
  "is_custom",
  "synonyms",
  "antonyms",
  "collocations",
  "example_sentences",
] as const;

export type VocabExportScope = "all" | "corpus" | "my_words";

export function isValidExportScope(v: string | null): v is VocabExportScope {
  return v === "all" || v === "corpus" || v === "my_words";
}

export function wordToExportRow(w: Record<string, unknown>): string[] {
  return [
    w.rank != null && w.rank !== "" ? String(w.rank) : "",
    String(w.word ?? ""),
    String(w.part_of_speech ?? ""),
    String(w.category ?? ""),
    String(w.definition ?? ""),
    String(w.translation_zh ?? ""),
    String(w.ipa ?? ""),
    w.is_custom ? "true" : "false",
    arrayToCsvField(w.synonyms),
    arrayToCsvField(w.antonyms),
    arrayToCsvField(w.collocations),
    arrayToCsvField(w.example_sentences),
  ];
}
