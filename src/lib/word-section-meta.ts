import type { WordCardEditSectionId } from "@/lib/word-card-edit-types";

export const WORD_SECTION_IDS: WordCardEditSectionId[] = [
  "back_header",
  "back_definition",
  "back_synonyms",
  "back_antonyms",
  "back_collocations",
  "back_examples",
  "back_unnatural_english",
];

export const WORD_SECTION_LABELS: Record<WordCardEditSectionId, string> = {
  back_header: "Word details",
  back_definition: "Definition",
  back_synonyms: "Synonyms",
  back_antonyms: "Antonyms",
  back_collocations: "Collocations",
  back_examples: "Example sentences",
  back_unnatural_english: "Unnatural English",
};

export function isWordCardEditSectionId(
  value: string
): value is WordCardEditSectionId {
  return (WORD_SECTION_IDS as string[]).includes(value);
}

export function wordSectionEditPath(
  wordId: string,
  section: WordCardEditSectionId
): string {
  return `/words/${wordId}/edit/${section}`;
}

/** Browse edit routes for definition EN / 中文 tabs (not inline section ids). */
export type DefinitionEditSlug = "definition-en" | "definition-zh";

export type ImageEditSlug = "image";

export type WordEditSectionSlug =
  | WordCardEditSectionId
  | DefinitionEditSlug
  | ImageEditSlug;

export function parseWordEditSectionSlug(
  value: string
): WordEditSectionSlug | null {
  if (isWordCardEditSectionId(value)) return value;
  if (value === "definition-en" || value === "definition-zh") return value;
  if (value === "image") return value;
  return null;
}

export function wordImageEditPath(wordId: string): string {
  return `/words/${wordId}/edit/image`;
}

export function definitionEditPath(
  wordId: string,
  lang: "en" | "zh"
): string {
  return `/words/${wordId}/edit/${lang === "en" ? "definition-en" : "definition-zh"}`;
}

export function wordEditSectionLabel(slug: WordEditSectionSlug): string {
  if (slug === "definition-en") return "English definition";
  if (slug === "definition-zh") return "中文 definition";
  if (slug === "image") return "Card image";
  return WORD_SECTION_LABELS[slug];
}

/** True on `/words/:id/edit/:section` — hide app bottom nav. */
export function isWordSectionEditPath(pathname: string): boolean {
  return /^\/words\/[^/]+\/edit\/[^/]+$/.test(pathname);
}
