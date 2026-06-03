import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { fetchDictionary } from "@/lib/dictionary";
import type { DictionaryEnrichment } from "@/lib/dictionary";
import {
  buildVisualPrompt,
  hashSeed,
  pollinationsImageUrl,
} from "@/lib/card-image";
import { mymemoryTranslateToZh } from "@/lib/mymemory-translate";
import { isPhraseEntry } from "@/lib/word-entry";

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return [t];
    }
  }
  return [];
}

function uniqueStrings(a: string[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of a) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

/** Dictionary diagram GIFs often include labels users don't want on cards; we use generated art instead. */
function isMwStockDictionaryIllustrationUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("learnersdictionary.com/art/") ||
    u.includes("merriam-webster.com/assets/mw/static/art/")
  );
}

type AiCardPatch = {
  translation_zh?: string;
  mnemonic?: string;
  image_prompt?: string;
  word_family?: string;
  definition?: string;
  ipa?: string;
  part_of_speech?: string;
  category?: string;
  example_sentences?: string[];
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
};

async function openAiFillGaps(params: {
  lemma: string;
  dict: DictionaryEnrichment | null;
  row: Record<string, unknown>;
}): Promise<AiCardPatch | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const openai = new OpenAI({ apiKey: key });
  const rowExamples = asStringArray(params.row.example_sentences);
  const rowSyn = asStringArray(params.row.synonyms);
  const rowAnt = asStringArray(params.row.antonyms);
  const rowCol = asStringArray(params.row.collocations);
  const rowLegacyExpr = asStringArray(
    (params.row as Record<string, unknown>).common_expressions
  );
  const rowSynEffective =
    rowSyn.length > 0 ? rowSyn : rowLegacyExpr;
  const rowDef = String(params.row.definition ?? "").trim();
  const rowZh = String(params.row.translation_zh ?? "").trim();
  const rowMn = String(params.row.mnemonic ?? "").trim();
  const rowImg = String(params.row.image_prompt ?? "").trim();
  const rowFam = String(params.row.word_family ?? "").trim();

  const dictSummary = params.dict
    ? `Merriam-Webster Learner's (preferred), Collegiate when needed — trust IPA, gloss, examples, synonyms when present:\n${JSON.stringify(
        {
          ipa: params.dict.ipa,
          definition: params.dict.definition,
          part_of_speech: params.dict.part_of_speech,
          example_sentences: params.dict.example_sentences,
          synonyms: params.dict.synonyms,
          antonyms: params.dict.antonyms,
          collocations: params.dict.collocations,
        },
        null,
        0
      )}`
    : "No Merriam-Webster entry for this lemma.";

  const user = `Lemma: "${params.lemma}"

${dictSummary}

Current DB (may be empty):
- definition: ${rowDef || "(empty)"}
- translation_zh: ${rowZh || "(empty)"}
- mnemonic: ${rowMn || "(empty)"}
- image_prompt: ${rowImg || "(empty)"}
- word_family: ${rowFam || "(empty)"}
- example_sentences: ${JSON.stringify(rowExamples)}
- synonyms: ${JSON.stringify(rowSynEffective)}
- antonyms: ${JSON.stringify(rowAnt)}
- collocations: ${JSON.stringify(rowCol)}

Return JSON only with keys (omit key or use empty string/array if already well covered by dictionary and DB):
- "translation_zh": concise Simplified Chinese gloss
- "mnemonic": one short English memory hook (max 140 chars)
- "image_prompt": one vivid but classroom-safe phrase for an illustration (no text in image), max 200 chars
- "word_family": comma-separated related word forms if applicable, else ""
- "definition": fuller English explanation ONLY if dictionary/DB definition is missing or shorter than ~40 characters; else ""
- "ipa": IPA string ONLY if missing in dictionary and you are confident; else ""
- "part_of_speech": ONLY if missing; else ""
- "category": one of: academic, business, science, medicine, art, technology, daily conversation, law, politics, sports, music, food, travel, education, nature — ONLY if missing; else ""
- "example_sentences": string[] with 2–3 natural sentences ONLY if fewer than 2 good examples exist total; else []
- "synonyms": string[] with a few useful synonyms ONLY if fewer than 3 exist total from dictionary + DB; else []
- "antonyms": string[] with clear opposites ONLY if dictionary + DB list fewer than 2; else []
- "collocations": string[] with 3–6 natural phrases including the lemma ONLY if fewer than 3 phrases exist total; else []

Prefer dictionary IPA and definitions when they exist.${
    !params.dict
      ? "\n\nThere is NO dictionary entry: you MUST return a clear definition (not empty), at least 3 example_sentences, translation_zh, mnemonic, image_prompt, word_family, part_of_speech, and category suitable for learners."
      : ""
  }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You help enrich English vocabulary cards. Reply with valid JSON only, no markdown.",
      },
      { role: "user", content: user },
    ],
    temperature: 0.45,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text) as AiCardPatch;
  } catch {
    return null;
  }
}

/** Second pass when lists are still empty after MW + first AI call (models often omit optional arrays). */
async function openAiEnsureWordLists(params: {
  lemma: string;
  definition: string;
  existingExamples: string[];
  existingSynonyms: string[];
  existingAntonyms: string[];
  existingCollocations: string[];
}): Promise<AiCardPatch | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const openai = new OpenAI({ apiKey: key });
  const user = `Lemma: "${params.lemma}"
Definition (English): ${params.definition.trim() || "(none — infer from lemma only if needed)"}

Already on the card (do not repeat these; you may still add NEW items):
- example_sentences: ${JSON.stringify(params.existingExamples)}
- synonyms: ${JSON.stringify(params.existingSynonyms)}
- antonyms: ${JSON.stringify(params.existingAntonyms)}
- collocations: ${JSON.stringify(params.existingCollocations)}

Return JSON only with exactly these keys (all required):
- "example_sentences": string[] with at least 3 fluent learner sentences that USE the lemma naturally.
- "synonyms": string[] with at least 6 useful synonyms or near-synonyms (single words or very short phrases).
- "antonyms": string[] with 1–6 clear opposites where natural; otherwise [].
- "collocations": string[] with at least 5 idiomatic phrases or patterns that INCLUDE the lemma.

No markdown, no commentary.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You fill vocabulary flashcard lists. Reply with valid JSON only.",
      },
      { role: "user", content: user },
    ],
    temperature: 0.35,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text) as AiCardPatch;
  } catch {
    return null;
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: row, error: fetchErr } = await supabase
      .from("words")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr?.code === "PGRST116") {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }
    if (fetchErr || !row) {
      return NextResponse.json(
        { error: fetchErr?.message ?? "Not found" },
        { status: 500 }
      );
    }

    const lemma = String(row.word ?? "").trim();
    const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());

    /** Replace MW stock diagram art with generated art whenever we see it (any card). */
    const imgUrl = String(row.image_url ?? "").trim();
    if (imgUrl && isMwStockDictionaryIllustrationUrl(imgUrl)) {
      const vp = buildVisualPrompt(
        lemma,
        String(row.definition ?? ""),
        String(row.image_prompt ?? "").trim() || null
      );
      const newImg = pollinationsImageUrl(vp, hashSeed(id));
      const { data: upgradedMw, error: upMw } = await supabase
        .from("words")
        .update({ image_url: newImg })
        .eq("id", id)
        .select()
        .single();
      if (!upMw && upgradedMw) {
        Object.assign(row, upgradedMw);
      }
    }

    /* Merriam-Webster only indexes single headwords, so a multi-word phrase
       matches its first word and yields first-word definitions/synonyms/etc.
       Skip the dictionary for phrases and let the AI cover the whole phrase. */
    const isPhrase = isPhraseEntry(lemma);
    const dict = isPhrase ? null : await fetchDictionary(lemma);

    const rowSynRaw = asStringArray(row.synonyms);
    const rowLegacyExpr = asStringArray(
      (row as Record<string, unknown>).common_expressions
    );
    const rowSynEffective =
      rowSynRaw.length > 0 ? rowSynRaw : rowLegacyExpr;
    const rowAntDb = asStringArray(row.antonyms);
    const rowColDb = asStringArray(row.collocations);

    if (!dict && !hasKey) {
      return NextResponse.json({
        word: row,
        skipped: true,
        reason: "unavailable",
        message:
          "No Merriam-Webster entry (Learner's / Collegiate API keys — MERRIAM_WEBSTER_LEARNERS_API_KEY / MERRIAM_WEBSTER_API_KEY) and OPENAI_API_KEY is not set; add keys or use Search → Generate with AI.",
      });
    }

    let definition = dict?.definition
      ? dict.definition
      : String(row.definition ?? "").trim();
    let ipa = dict?.ipa ? dict.ipa : String(row.ipa ?? "").trim();
    let part_of_speech = dict?.part_of_speech
      ? dict.part_of_speech
      : String(row.part_of_speech ?? "").trim();
    let category = String(row.category ?? "").trim();
    /* Precedence: MW Dictionary first, then OpenAI passes (appended below),
       then existing DB row as a backstop (appended after all AI). */
    let example_sentences = uniqueStrings(
      [...(dict?.example_sentences ?? [])],
      6
    );
    /* Precedence: MW (Thesaurus → Dictionary, ordered inside dict.synonyms),
       then existing DB row / legacy common_expressions as a backstop. AI passes append after. */
    let synonyms = uniqueStrings(
      [...(dict?.synonyms ?? []), ...rowSynEffective],
      22
    );
    /* Precedence: MW (Thesaurus → Dictionary) first, then existing DB row as backstop. */
    let antonyms = uniqueStrings(
      [...(dict?.antonyms ?? []), ...rowAntDb],
      16
    );
    /* Precedence: MW (Learner's → Thesaurus phrase_list, ordered inside dict.collocations),
       then existing DB row as a backstop. AI passes append after. */
    let collocations = uniqueStrings(
      [...(dict?.collocations ?? []), ...rowColDb],
      14
    );
    let pronunciation_url =
      dict?.pronunciation_url ?? (row.pronunciation_url as string | null);
    let translation_zh = String(row.translation_zh ?? "").trim();
    let mnemonic = String(row.mnemonic ?? "").trim();
    let image_prompt = String(row.image_prompt ?? "").trim();
    let word_family = String(row.word_family ?? "").trim();
    let image_url = String(row.image_url ?? "").trim();

    const ai = await openAiFillGaps({ lemma, dict, row }).catch((err) => {
      console.error(`[enrich] openAiFillGaps failed for "${lemma}":`, err);
      return null;
    });
    if (ai) {
      if (ai.translation_zh?.trim() && !translation_zh)
        translation_zh = ai.translation_zh.trim();
      if (ai.mnemonic?.trim() && !mnemonic) mnemonic = ai.mnemonic.trim();
      if (ai.image_prompt?.trim()) image_prompt = ai.image_prompt.trim();
      if (ai.word_family?.trim() && !word_family)
        word_family = ai.word_family.trim();
      if (ai.definition?.trim() && definition.length < 40)
        definition = ai.definition.trim();
      if (ai.ipa?.trim() && !ipa) ipa = ai.ipa.trim();
      if (ai.part_of_speech?.trim() && !part_of_speech)
        part_of_speech = ai.part_of_speech.trim();
      if (ai.category?.trim() && !category) category = ai.category.trim();
      if (Array.isArray(ai.example_sentences) && ai.example_sentences.length) {
        example_sentences = uniqueStrings(
          [...example_sentences, ...ai.example_sentences.map(String)],
          6
        );
      }
      if (Array.isArray(ai.synonyms) && ai.synonyms.length) {
        synonyms = uniqueStrings(
          [...synonyms, ...ai.synonyms.map(String)],
          22
        );
      }
      if (Array.isArray(ai.antonyms) && ai.antonyms.length) {
        antonyms = uniqueStrings(
          [...antonyms, ...ai.antonyms.map(String)],
          16
        );
      }
      if (Array.isArray(ai.collocations) && ai.collocations.length) {
        collocations = uniqueStrings(
          [...collocations, ...ai.collocations.map(String)],
          14
        );
      }
    }

    if (
      hasKey &&
      (example_sentences.length < 2 ||
        synonyms.length < 3 ||
        collocations.length < 3)
    ) {
      const ensured = await openAiEnsureWordLists({
        lemma,
        definition:
          definition.trim() ||
          String(row.definition ?? "").trim() ||
          (dict?.definition ?? ""),
        existingExamples: example_sentences,
        existingSynonyms: synonyms,
        existingAntonyms: antonyms,
        existingCollocations: collocations,
      }).catch((err) => {
        console.error(
          `[enrich] openAiEnsureWordLists failed for "${lemma}":`,
          err
        );
        return null;
      });
      if (ensured) {
        if (
          Array.isArray(ensured.example_sentences) &&
          ensured.example_sentences.length
        ) {
          example_sentences = uniqueStrings(
            [...example_sentences, ...ensured.example_sentences.map(String)],
            6
          );
        }
        if (Array.isArray(ensured.synonyms) && ensured.synonyms.length) {
          synonyms = uniqueStrings(
            [...synonyms, ...ensured.synonyms.map(String)],
            22
          );
        }
        if (Array.isArray(ensured.antonyms) && ensured.antonyms.length) {
          antonyms = uniqueStrings(
            [...antonyms, ...ensured.antonyms.map(String)],
            16
          );
        }
        if (
          Array.isArray(ensured.collocations) &&
          ensured.collocations.length
        ) {
          collocations = uniqueStrings(
            [...collocations, ...ensured.collocations.map(String)],
            14
          );
        }
      }
    }

    /* Existing DB examples are the lowest-priority source: appended at the very end
       so MW + AI items keep their leading positions, but stored content is never lost. */
    example_sentences = uniqueStrings(
      [...example_sentences, ...asStringArray(row.example_sentences)],
      6
    );

    if (!translation_zh && dict?.definition) {
      const zhMn = await enrichZhMnemonicOnly(lemma, dict.definition).catch(
        (err) => {
          console.error(
            `[enrich] enrichZhMnemonicOnly failed for "${lemma}":`,
            err
          );
          return null;
        }
      );
      if (zhMn) {
        if (zhMn.translation_zh) translation_zh = zhMn.translation_zh;
        if (zhMn.mnemonic && !mnemonic) mnemonic = zhMn.mnemonic;
      }
    }

    if (!translation_zh && definition.trim()) {
      const bundle =
        lemma.length <= 5
          ? `English word "${lemma}" (grammar word). Main senses: ${definition.slice(0, 400)}`
          : definition.slice(0, 450);
      const mt = await mymemoryTranslateToZh(bundle).catch(() => null);
      if (mt) translation_zh = mt;
    }

    const visualPrompt = buildVisualPrompt(
      lemma,
      definition || image_prompt,
      image_prompt || null
    );

    if (!image_url || isMwStockDictionaryIllustrationUrl(image_url)) {
      image_url = pollinationsImageUrl(visualPrompt, hashSeed(id));
    }

    const updates = {
      definition: definition || row.definition,
      ipa: ipa || row.ipa,
      part_of_speech: part_of_speech || row.part_of_speech,
      category: category || row.category,
      example_sentences:
        example_sentences.length > 0 ? example_sentences : row.example_sentences,
      synonyms:
        synonyms.length > 0 ? synonyms : asStringArray(row.synonyms),
      antonyms:
        antonyms.length > 0 ? antonyms : asStringArray(row.antonyms),
      collocations:
        collocations.length > 0
          ? collocations
          : asStringArray(row.collocations),
      pronunciation_url: pronunciation_url ?? row.pronunciation_url,
      translation_zh: translation_zh || row.translation_zh,
      mnemonic: mnemonic || row.mnemonic,
      image_prompt: image_prompt || row.image_prompt,
      word_family: word_family || row.word_family,
      image_url: image_url || row.image_url,
    };

    const { data: updated, error: upErr } = await supabase
      .from("words")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ word: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Enrichment failed" },
      { status: 500 }
    );
  }
}

/** Fallback when full gap-filling model is not used (no key path already returned). */
async function enrichZhMnemonicOnly(
  lemma: string,
  definition: string
): Promise<{ translation_zh: string; mnemonic: string } | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `English word: "${lemma}"
English definition (may be short): ${definition}

Return JSON only with keys:
- "translation_zh": concise Simplified Chinese gloss (a few characters to a short phrase)
- "mnemonic": one short English memory hook (max 120 characters)`,
      },
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;
  const parsed = JSON.parse(text) as {
    translation_zh?: string;
    mnemonic?: string;
  };
  return {
    translation_zh: String(parsed.translation_zh ?? "").trim(),
    mnemonic: String(parsed.mnemonic ?? "").trim(),
  };
}
