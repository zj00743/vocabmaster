import type { WordEditSectionSlug } from "@/lib/word-section-meta";
import type { WordWithProgress } from "@/lib/types";
import { definitionToEditLines, editLinesToDefinition } from "@/lib/word-utils";
import {
  type EntryType,
  lemmasEqualForStorage,
  lemmaUnchangedForUpdate,
  normalizeLemmaForStorage,
  resolveEntryType,
  resolveShowImage,
  validateEntryTypeLemma,
} from "@/lib/word-entry";

export type BuildSectionPatchOptions = {
  /** Set when the user edited the lemma field (allows intentional case changes). */
  lemmaEdited?: boolean;
};

export type SectionFieldValues = {
  lemma: string;
  ipa: string;
  tagIds: string[];
  partOfSpeech: string;
  entryType: EntryType;
  showImage: boolean;
  definition: string;
  translationZh: string;
  examplesText: string;
  unnaturalEnglishText: string;
  synonymsText: string;
  antonymsText: string;
  collocationsText: string;
};

export function sectionFieldsFromWord(word: WordWithProgress): SectionFieldValues {
  return {
    lemma: word.word ?? "",
    ipa: (word.ipa ?? "").trim(),
    tagIds: (word.tags ?? []).map((t) => t.id),
    partOfSpeech: (word.part_of_speech ?? "").trim(),
    entryType: resolveEntryType(word.word ?? "", word.entry_type),
    showImage: resolveShowImage(word.word ?? "", word.entry_type, word.show_image),
    definition: definitionToEditLines(word.definition ?? ""),
    translationZh: definitionToEditLines(word.translation_zh ?? ""),
    examplesText: word.example_sentences.filter(Boolean).join("\n"),
    unnaturalEnglishText: word.unnatural_english.filter(Boolean).join("\n"),
    synonymsText: word.synonyms.filter(Boolean).join("\n"),
    antonymsText: word.antonyms.filter(Boolean).join("\n"),
    collocationsText: word.collocations.filter(Boolean).join("\n"),
  };
}

/** Pre-fill empty EN definition fields with the same dictionary hint shown on the card. */
export function applyDictionaryHintToSectionFields(
  sectionId: WordEditSectionSlug,
  values: SectionFieldValues,
  hint: string | null | undefined
): SectionFieldValues {
  const h = hint?.trim();
  if (!h || values.definition.trim()) return values;
  if (sectionId === "definition-en" || sectionId === "back_definition") {
    return { ...values, definition: definitionToEditLines(h) };
  }
  return values;
}

function linesFromText(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateSectionFields(
  sectionId: WordEditSectionSlug,
  values: SectionFieldValues
): string | null {
  if (sectionId !== "back_header") return null;
  return validateEntryTypeLemma(values.entryType, values.lemma);
}

export function buildSectionPatchPayload(
  sectionId: WordEditSectionSlug,
  word: WordWithProgress,
  values: SectionFieldValues,
  options?: BuildSectionPatchOptions
): Record<string, unknown> {
  switch (sectionId) {
    case "back_header": {
      const payload: Record<string, unknown> = {
        ipa: values.ipa.trim(),
        part_of_speech: values.partOfSpeech.trim(),
        entry_type: values.entryType,
        show_image: values.showImage,
      };
      if (word.is_custom) {
        const lemma = values.lemma.trim() || word.word;
        const stored = word.word ?? "";
        const includeLemma = options?.lemmaEdited
          ? !lemmasEqualForStorage(lemma, stored)
          : !lemmaUnchangedForUpdate(lemma, stored);
        if (includeLemma) {
          payload.word = normalizeLemmaForStorage(lemma);
        }
      }
      return payload;
    }
    case "back_definition":
      return {
        definition: editLinesToDefinition(values.definition),
        translation_zh: editLinesToDefinition(values.translationZh),
      };
    case "definition-en":
      return { definition: editLinesToDefinition(values.definition) };
    case "definition-zh":
      return { translation_zh: editLinesToDefinition(values.translationZh) };
    case "back_examples":
      return { example_sentences: linesFromText(values.examplesText) };
    case "back_unnatural_english":
      return { unnatural_english: linesFromText(values.unnaturalEnglishText) };
    case "back_synonyms":
      return { synonyms: linesFromText(values.synonymsText) };
    case "back_antonyms":
      return { antonyms: linesFromText(values.antonymsText) };
    case "back_collocations":
      return { collocations: linesFromText(values.collocationsText) };
    default:
      return {};
  }
}
