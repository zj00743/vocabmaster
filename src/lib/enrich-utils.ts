import type { WordWithProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";

/** True when the card should call POST /api/words/:id/enrich again. */
export function needsAutoEnrich(raw: WordWithProgress): boolean {
  const w = normalizeWord(raw);
  const def = w.definition.trim().length;
  const ex = w.example_sentences.length;
  const img = (w.image_url ?? "").trim().length > 0;
  const syn = w.synonyms.filter(Boolean).length;
  return def < 40 || ex < 2 || !img || syn < 2;
}
