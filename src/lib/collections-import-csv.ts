import {
  normalizeEntryTypeForStorage,
  type EntryType,
} from "@/lib/word-entry";

export type CollectionsImportRow = {
  word: string;
  entry_type: EntryType | null;
  definition: string;
  translation_zh: string;
  part_of_speech: string;
  ipa: string;
  tags: string[];
  example_sentences: string[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  show_image: boolean | null;
};

export function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, ""));
}

function splitList(raw: string | undefined, separator = "|"): string[] {
  return (raw ?? "")
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEntryType(raw: string | undefined, word: string): EntryType | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "word" || v === "expression") return v;
  return normalizeEntryTypeForStorage(v, word);
}

function parseShowImage(raw: string | undefined): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}

/** Parse a My collections import CSV (see templates/my-collections-import-template.csv). */
export function parseCollectionsImportCsv(content: string): CollectionsImportRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const first = lines[0];
  const tabCount = (first.match(/\t/g) ?? []).length;
  const commaCount = (first.match(/,/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  const headers = parseCsvLine(lines[0].toLowerCase(), delimiter).map((h) =>
    h.trim().replace(/"/g, "")
  );

  const wordIdx = headers.findIndex(
    (h) => h === "word" || h === "lemma" || h.includes("word")
  );
  if (wordIdx === -1) return [];

  const entryTypeIdx = headers.findIndex(
    (h) => h === "entry_type" || h === "type"
  );
  const defIdx = headers.findIndex((h) => h.includes("definition"));
  const zhIdx = headers.findIndex(
    (h) => h.includes("translation") || h === "zh" || h === "translation_zh"
  );
  const posIdx = headers.findIndex(
    (h) => h.includes("pos") || h.includes("part")
  );
  const ipaIdx = headers.findIndex((h) => h === "ipa");
  const tagsIdx = headers.findIndex((h) => h === "tags" || h === "tag");
  const synIdx = headers.findIndex((h) => h.includes("synonym"));
  const antIdx = headers.findIndex((h) => h.includes("antonym"));
  const colIdx = headers.findIndex((h) => h.includes("collocation"));
  const exIdx = headers.findIndex(
    (h) => h.includes("example") || h.includes("sentence")
  );
  const showImageIdx = headers.findIndex(
    (h) => h === "show_image" || h === "image"
  );

  const rows: CollectionsImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const word = cols[wordIdx]?.trim();
    if (!word) continue;

    rows.push({
      word,
      entry_type: parseEntryType(
        entryTypeIdx !== -1 ? cols[entryTypeIdx] : undefined,
        word
      ),
      definition: defIdx !== -1 ? (cols[defIdx] ?? "").trim() : "",
      translation_zh: zhIdx !== -1 ? (cols[zhIdx] ?? "").trim() : "",
      part_of_speech: posIdx !== -1 ? (cols[posIdx] ?? "").trim() : "",
      ipa: ipaIdx !== -1 ? (cols[ipaIdx] ?? "").trim() : "",
      tags: tagsIdx !== -1 ? splitList(cols[tagsIdx]) : [],
      example_sentences: exIdx !== -1 ? splitList(cols[exIdx]) : [],
      synonyms: synIdx !== -1 ? splitList(cols[synIdx]) : [],
      antonyms: antIdx !== -1 ? splitList(cols[antIdx]) : [],
      collocations: colIdx !== -1 ? splitList(cols[colIdx]) : [],
      show_image: parseShowImage(
        showImageIdx !== -1 ? cols[showImageIdx] : undefined
      ),
    });
  }

  return rows;
}
