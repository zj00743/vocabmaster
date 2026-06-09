import type { WordEditSectionSlug } from "@/lib/word-section-meta";
import type { WordWithProgress } from "@/lib/types";
import { definitionToEditLines, editLinesToDefinition } from "@/lib/word-utils";
import {
  type EntryType,
  resolveEntryType,
  resolveShowImage,
} from "@/lib/word-entry";

export type SectionFieldValues = {
  lemma: string;
  ipa: string;
  category: string;
  partOfSpeech: string;
  entryType: EntryType;
  showImage: boolean;
  definition: string;
  translationZh: string;
  examplesText: string;
  synonymsText: string;
  antonymsText: string;
  collocationsText: string;
};

export function sectionFieldsFromWord(word: WordWithProgress): SectionFieldValues {
  return {
    lemma: word.word ?? "",
    ipa: (word.ipa ?? "").trim(),
    category: (word.category ?? "").trim(),
    partOfSpeech: (word.part_of_speech ?? "").trim(),
    entryType: resolveEntryType(word.word ?? "", word.entry_type),
    showImage: resolveShowImage(word.word ?? "", word.entry_type, word.show_image),
    /* Definition/translation are edited as one sense per line; collapse to the
       stored `" · "` form only at save time so typing spaces/newlines works. */
    definition: definitionToEditLines(word.definition ?? ""),
    translationZh: definitionToEditLines(word.translation_zh ?? ""),
    examplesText: word.example_sentences.filter(Boolean).join("\n"),
    synonymsText: word.synonyms.filter(Boolean).join("\n"),
    antonymsText: word.antonyms.filter(Boolean).join("\n"),
    collocationsText: word.collocations.filter(Boolean).join("\n"),
  };
}

function linesFromText(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildSectionPatchPayload(
  sectionId: WordEditSectionSlug,
  word: WordWithProgress,
  values: SectionFieldValues
): Record<string, unknown> {
  switch (sectionId) {
    case "back_header": {
      const payload: Record<string, unknown> = {
        ipa: values.ipa.trim(),
        category: values.category.trim() || "",
        part_of_speech: values.partOfSpeech.trim(),
        entry_type: values.entryType,
        show_image: values.showImage,
      };
      if (word.is_custom) {
        payload.word = values.lemma.trim() || word.word;
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
