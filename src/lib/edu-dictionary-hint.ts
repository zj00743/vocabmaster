import { fetchMerriamWebsterFirstGloss } from "@/lib/merriam-webster";

export type DictionaryHintSource = "merriam-webster" | "none";

/**
 * English gloss for flashcard front — Merriam-Webster (Learner's, else Collegiate).
 * Requires MERRIAM_WEBSTER_API_KEY in the environment.
 */
export async function resolveDictionaryHint(lemma: string): Promise<{
  hint: string | null;
  source: DictionaryHintSource;
}> {
  const hint = await fetchMerriamWebsterFirstGloss(lemma).catch(() => null);
  if (hint) return { hint, source: "merriam-webster" };
  return { hint: null, source: "none" };
}
