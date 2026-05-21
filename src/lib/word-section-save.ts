import type { WordEditSectionSlug } from "@/lib/word-section-meta";
import type { WordWithProgress } from "@/lib/types";

export type SectionFieldValues = {
  lemma: string;
  ipa: string;
  category: string;
  partOfSpeech: string;
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
    definition: word.definition ?? "",
    translationZh: word.translation_zh ?? "",
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
      };
      if (word.is_custom) {
        payload.word = values.lemma.trim() || word.word;
      }
      return payload;
    }
    case "back_definition":
      return {
        definition: values.definition.trim(),
        translation_zh: values.translationZh.trim(),
      };
    case "definition-en":
      return { definition: values.definition.trim() };
    case "definition-zh":
      return { translation_zh: values.translationZh.trim() };
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
