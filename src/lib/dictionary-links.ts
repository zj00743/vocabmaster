/** Deep links to third-party dictionaries for a lemma (word or phrase). */

function slugHyphen(lemma: string): string {
  return lemma.trim().toLowerCase().replace(/\s+/g, "-");
}

function wikiTitle(lemma: string): string {
  return lemma.trim().replace(/\s+/g, "_");
}

export type ExternalDictionaryResource = {
  id: string;
  label: string;
  href: string;
};

export function externalDictionaryResources(lemma: string): ExternalDictionaryResource[] {
  const raw = lemma.trim();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  const hyphen = slugHyphen(raw);
  const encoded = encodeURIComponent(lower);
  const encodedHyphen = encodeURIComponent(hyphen);
  const wiki = encodeURIComponent(wikiTitle(raw));

  return [
    {
      id: "merriam-webster",
      label: "merriam-webster.com",
      href: `https://www.merriam-webster.com/dictionary/${encoded}`,
    },
    {
      id: "merriam-webster-thesaurus",
      label: "Merriam-Webster Thesaurus (synonyms & antonyms)",
      href: `https://www.merriam-webster.com/thesaurus/${encoded}`,
    },
    {
      id: "cambridge",
      label: "Cambridge Dictionary",
      href: `https://dictionary.cambridge.org/dictionary/english/${encodedHyphen}`,
    },
    {
      id: "dictionary-com",
      label: "Dictionary.com",
      href: `https://www.dictionary.com/browse/${encodedHyphen}`,
    },
    {
      id: "urban-dictionary",
      label: "Urban Dictionary",
      href: `https://www.urbandictionary.com/define.php?term=${encodeURIComponent(raw)}`,
    },
    {
      id: "wikipedia",
      label: "Wikipedia",
      href: `https://en.wikipedia.org/wiki/${wiki}`,
    },
  ];
}
