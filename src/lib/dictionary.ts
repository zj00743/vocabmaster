export type DictionaryEnrichment = {
  ipa: string;
  definition: string;
  part_of_speech: string;
  example_sentences: string[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  pronunciation_url: string | null;
};

export { fetchMerriamWebster as fetchDictionary } from "@/lib/merriam-webster";
