import type { WordWithProgress } from "@/lib/types";
import { isPhraseEntry } from "@/lib/word-entry";

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x)).filter(Boolean);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return [t];
    }
  }
  return [];
}

/** Coerce API / DB rows into safe shapes for React (avoids .map on null). */
export function normalizeWord(raw: WordWithProgress): WordWithProgress {
  const legacyExprs = asStringArray(
    (raw as unknown as { common_expressions?: unknown }).common_expressions
  );
  const synonymsPrimary = asStringArray(raw.synonyms as unknown);

  return {
    ...raw,
    word: String(raw.word ?? ""),
    definition: String(raw.definition ?? ""),
    translation_zh: String(raw.translation_zh ?? ""),
    ipa: String(raw.ipa ?? ""),
    part_of_speech: String(raw.part_of_speech ?? ""),
    example_sentences: asStringArray(raw.example_sentences as unknown),
    synonyms:
      synonymsPrimary.length > 0 ? synonymsPrimary : legacyExprs,
    antonyms: asStringArray(raw.antonyms as unknown),
    collocations: asStringArray(raw.collocations as unknown),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

/**
 * Gloss strings in the DB often join senses with `" · "`; this matches flashcard bullet view.
 */
export function splitStoredDefinitionLines(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.includes(" · ")) {
    return t
      .split(/\s·\s/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [t];
}

/** Multi-line textarea for editing; order matches bullets in preview. */
export function definitionToEditLines(stored: string): string {
  return splitStoredDefinitionLines(stored).join("\n");
}

/** Rejoin edited lines back to stored gloss (`" · "` between senses). */
export function editLinesToDefinition(editText: string): string {
  const lines = editText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  return lines.join(" · ");
}

export function frontHint(
  word: WordWithProgress,
  opts?: { rankShownOnCard?: boolean; skipMnemonic?: boolean }
): string {
  const exprs = (word.synonyms ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (exprs.length > 0) {
    let joined = exprs.slice(0, 4).join(", ");
    if (joined.length > 140) joined = exprs.slice(0, 2).join(", ");
    if (joined.length > 140) {
      return `${joined.slice(0, 137).replace(/[,.\s]+$/, "")}…`;
    }
    return joined;
  }

  const def = word.definition?.trim();
  if (def) {
    const firstSense =
      splitStoredDefinitionLines(def)[0]?.trim() ?? def.trim();
    const gloss =
      firstSense.length > 130 ? `${firstSense.slice(0, 127)}…` : firstSense;
    return gloss;
  }

  if (!opts?.skipMnemonic && word.mnemonic?.trim()) {
    const m = word.mnemonic.trim();
    return m.length > 130 ? `${m.slice(0, 127)}…` : m;
  }

  const pos = word.part_of_speech?.trim();
  if (pos && !isPhraseEntry(word.word)) {
    return `A common ${pos} — guess the word`;
  }

  if (word.rank != null && !opts?.rankShownOnCard) {
    return `Very common English word (#${word.rank}) — tap to reveal`;
  }

  return "Tap to reveal the word.";
}

/** Card front cue: first EN or 中文 sense when present; optional API hint for EN only. */
export function flashcardFrontGlossDisplay(
  word: WordWithProgress,
  opts?: {
    dictionaryHint?: string | null;
    rankShownOnCard?: boolean;
    lang?: "en" | "zh";
  }
): string {
  const lang = opts?.lang ?? "en";

  if (lang === "zh") {
    const firstZh = splitStoredDefinitionLines(
      word.translation_zh ?? ""
    )[0]?.trim();
    return firstZh ?? "";
  }

  const firstFromDefs = splitStoredDefinitionLines(word.definition ?? "")[0]?.trim();
  if (firstFromDefs) {
    return firstFromDefs;
  }
  const dh = opts?.dictionaryHint?.trim();
  if (dh) {
    const fromHint = splitStoredDefinitionLines(dh)[0]?.trim();
    if (fromHint) {
      return fromHint;
    }
  }
  return frontHint(word, {
    rankShownOnCard: opts?.rankShownOnCard ?? word.rank != null,
    skipMnemonic: true,
  });
}
