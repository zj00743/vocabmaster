/**
 * MyMemory public translation (no API key). Low quota; best-effort for
 * Simplified Chinese when OPENAI is not configured.
 * https://mymemory.translated.net/doc/spec.php
 */

export async function mymemoryTranslateToZh(
  englishText: string
): Promise<string | null> {
  const q = englishText.trim().slice(0, 450);
  if (!q) return null;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    q
  )}&langpair=en|zh-CN`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const j = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  if (j.responseStatus === 429) return null;

  const t = j.responseData?.translatedText?.trim();
  if (!t) return null;
  if (t.includes("MYMEMORY WARNING")) return null;
  return t;
}
