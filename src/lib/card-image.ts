/**
 * Deterministic decorative image for a vocabulary card.
 * Uses Pollinations (no API key) — image is generated on demand from the prompt.
 * Prefix keeps prompts in a safe, educational style.
 */
const PROMPT_PREFIX =
  "Safe educational illustration, soft colors, no text, no letters, no words, no watermark: ";

export function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1_000_000;
}

export function buildVisualPrompt(
  lemma: string,
  definitionOrHint: string,
  existingImagePrompt: string | null | undefined
): string {
  const existing = existingImagePrompt?.trim();
  if (existing) return existing.slice(0, 400);
  const hint = definitionOrHint.trim().slice(0, 220);
  if (hint)
    return `English word "${lemma}" — visual metaphor for: ${hint}`.slice(0, 400);
  return `Abstract scene suggesting the meaning of the English word "${lemma}" for language learners.`.slice(
    0,
    400
  );
}

export function pollinationsImageUrl(
  visualPrompt: string,
  seed: number
): string {
  /** Keep URLs under ~2k chars so browsers and CDNs do not truncate requests. */
  const full = (PROMPT_PREFIX + visualPrompt).slice(0, 420);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=768&height=480&seed=${seed}&nologo=true`;
}
