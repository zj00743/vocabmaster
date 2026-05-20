import type { DictionaryEnrichment } from "@/lib/dictionary";

/* If the dev overlay points at `export type MerriamWebsterEntry` with "Expected '{', got ident",
   the line above is missing: `const THESAURUS_URL = "https://...thesaurus/json"` (no bare string). */

/** MW dictionary API base URLs (one line each to avoid orphaned string literals above `export type`). */
const LEARNERS_URL = "https://www.dictionaryapi.com/api/v3/references/learners/json";
const COLLEGIATE_URL = "https://www.dictionaryapi.com/api/v3/references/collegiate/json";
const THESAURUS_URL = "https://www.dictionaryapi.com/api/v3/references/thesaurus/json";

export type MerriamWebsterEntry = {
  meta?: {
    id?: string;
    src?: string;
    syns?: unknown;
    ants?: unknown;
    stems?: unknown;
  };
  hom?: number;
  hwi?: {
    hw?: string;
    prs?: { mw?: string; ipa?: string; sound?: { audio?: string } }[];
  };
  fl?: string;
  shortdef?: string[];
  def?: { sseq?: unknown[]; vd?: string }[];
  syns?: { pl?: string; pt?: unknown[] }[];
  ants?: { pl?: string; pt?: unknown[] }[];
  /** Learner's defined run-ons — idioms / multi-word phrases (see MW Learner's JSON). */
  dros?: { drp?: string; def?: { sseq?: unknown[] }[] }[];
  /** Collegiate supplementary examples and learner-dictionary quotient blocks (MW JSON). */
  suppl?: {
    examples?: { t?: string }[];
    ldq?: { def?: { sseq?: unknown[] }[] };
  };
};

/** Collegiate / general dictionary — used as fallback when Learner's is absent. */
function getCollegiateApiKey(): string | null {
  return (
    process.env.MERRIAM_WEBSTER_COLLEGIATE_API_KEY?.trim() ||
    process.env.MERRIAM_WEBSTER_API_KEY?.trim() ||
    null
  );
}

/** Learner's Dictionary — prefers dedicated key, else shared key for local dev. */
function getLearnersApiKey(): string | null {
  return (
    process.env.MERRIAM_WEBSTER_LEARNERS_API_KEY?.trim() ||
    process.env.MERRIAM_WEBSTER_API_KEY?.trim() ||
    null
  );
}

function getThesaurusApiKey(): string | null {
  return process.env.MERRIAM_WEBSTER_THESAURUS_API_KEY?.trim() || null;
}

export function merriamWebsterAudioUrl(audio: string): string {
  const sub = audio.startsWith("bix")
    ? "bix"
    : audio.startsWith("gg")
      ? "gg"
      : /^\d/.test(audio)
        ? "number"
        : audio[0];
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${sub}/${audio}.mp3`;
}

/** `{sx|lemma||}` cross-references in Collegiate/Learner's definition text → synonym-ish links. */
function extractSxLemmaLinks(raw: string): string[] {
  const out: string[] = [];
  const re = /\{sx\|([^|}]+)\|[^}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const t = stripMerriamWebsterMarkup(m[1]).trim();
    if (t.length > 1) out.push(t);
  }
  return out;
}

export function stripMerriamWebsterMarkup(text: string): string {
  return text
    .replace(/\{bc\}/g, "")
    .replace(/\{dx\}[\s\S]*?\{\/dx\}/g, "")
    .replace(/\{dx_n\}[\s\S]*?\{\/dx_n\}/g, "")
    .replace(/\{it\}|\{\/it\}/g, "")
    .replace(/\{wi\}|\{\/wi\}/g, "")
    .replace(/\{sx\|([^|}|]*)\|[^}]*\}/g, "$1")
    .replace(/\{a_link\|([^}|]*)\}/g, "$1")
    .replace(/\{d_link\|([^}|]*)\}/g, "$1")
    .replace(/\{ma\}[\s\S]*?\{\/ma\}/g, "")
    .replace(/\{gloss\|([^}|]*)\|[^}]*\}/g, "$1")
    .replace(/\{phrase\|([^}|]*)\|[^}]*\}/g, "$1")
    .replace(/\{qword\|([^}|]*)\|[^}]*\}/g, "$1")
    .replace(/\\\/\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchEntriesFromReference(
  baseUrl: string,
  lemma: string,
  key: string
): Promise<MerriamWebsterEntry[] | null> {
  const url = `${baseUrl}/${encodeURIComponent(lemma)}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;
  if (typeof data[0] === "string") return null;

  return data as MerriamWebsterEntry[];
}

/**
 * Fetch both Learner's and Collegiate when each key is configured, and merge entries.
 * Learner's-first alone hid Collegiate-only or fuller senses (e.g. some academic words).
 */
async function fetchMergedMerriamDictionaryEntries(
  lemma: string
): Promise<MerriamWebsterEntry[]> {
  const w = lemma.trim().toLowerCase();
  if (!w) return [];

  const combined: MerriamWebsterEntry[] = [];
  const seen = new Set<string>();

  const pushDeduped = (batch: MerriamWebsterEntry[] | null) => {
    if (!batch?.length) return;
    for (const e of batch) {
      const mid = String(e.meta?.id ?? "").toLowerCase();
      const src = String(
        (e.meta as { src?: string } | undefined)?.src ?? ""
      ).toLowerCase();
      const hom = e.hom ?? 0;
      const key = `${src}:${mid}:${hom}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(e);
    }
  };

  const lk = getLearnersApiKey();
  if (lk) {
    pushDeduped(
      await fetchEntriesFromReference(LEARNERS_URL, w, lk).catch(() => null)
    );
  }

  const ck = getCollegiateApiKey();
  if (ck) {
    pushDeduped(
      await fetchEntriesFromReference(COLLEGIATE_URL, w, ck).catch(() => null)
    );
  }

  return combined;
}

async function fetchPrimaryMerriamDictionaryEntries(
  lemma: string
): Promise<{
  entries: MerriamWebsterEntry[] | null;
  origin: "learners" | "collegiate" | null;
}> {
  const merged = await fetchMergedMerriamDictionaryEntries(lemma);
  if (!merged.length) return { entries: null, origin: null };

  const origins = new Set(
    merged.map((e) => (e.meta as { src?: string } | undefined)?.src)
  );
  let origin: "learners" | "collegiate" | null = null;
  if (origins.has("learners")) origin = "learners";
  else if (origins.has("collegiate")) origin = "collegiate";

  return { entries: merged, origin };
}

/** Prefer Learner's (with learners key); fall back to Collegiate (separate collegiate key optional). */
export async function fetchMerriamWebsterEntries(
  lemma: string
): Promise<MerriamWebsterEntry[] | null> {
  const { entries } = await fetchPrimaryMerriamDictionaryEntries(lemma);
  return entries;
}

/** MW learner/collegiate synonym/antonym blocks (`syns` / `ants`). */
function extractTextsFromMwSynAntBlocks(
  blocks: { pl?: string; pt?: unknown[] }[] | undefined
): string[] {
  const into: string[] = [];
  for (const blk of blocks ?? []) {
    if (!Array.isArray(blk.pt)) continue;
    for (const pt of blk.pt) {
      if (Array.isArray(pt) && pt[0] === "text") {
        const t = stripMerriamWebsterMarkup(String(pt[1] ?? "")).trim();
        if (t.length > 1) into.push(t);
      }
    }
  }
  return into;
}

/** Thesaurus `meta.syns` / `meta.ants`: arrays of synonym/antonym groups (often strings). */
function flattenMetaSynAntStrings(meta: unknown): {
  synonyms: string[];
  antonyms: string[];
} {
  const synonyms: string[] = [];
  const antonyms: string[] = [];
  if (!meta || typeof meta !== "object") return { synonyms, antonyms };
  const take = (key: "syns" | "ants", into: string[]) => {
    const v = (meta as Record<string, unknown>)[key];
    if (!Array.isArray(v)) return;
    for (const group of v) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (typeof item !== "string") continue;
        const t = stripMerriamWebsterMarkup(item).trim();
        if (t.length > 1) into.push(t);
      }
    }
  };
  take("syns", synonyms);
  take("ants", antonyms);
  return { synonyms, antonyms };
}

function processWdListArrays(arr: unknown, into: Set<string>) {
  if (!Array.isArray(arr)) return;
  for (const group of arr) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.wd === "string") {
        const t = stripMerriamWebsterMarkup(o.wd).trim();
        if (t.length > 1) into.add(t);
      }
      if (Array.isArray(o.wvbvrs)) {
        for (const wv of o.wvbvrs) {
          if (wv && typeof wv === "object") {
            const alt = (wv as { wvbva?: unknown }).wvbva;
            if (typeof alt === "string") {
              const t = stripMerriamWebsterMarkup(alt).trim();
              if (t.length > 1) into.add(t);
            }
          }
        }
      }
    }
  }
}

/**
 * Collegiate Thesaurus: syn_list / sim_list / meta.syns = core synonyms;
 * rel_list = related words (still useful near-synonyms per MW docs).
 * phrase_list / ant_list / near_list / meta.ants as before.
 * @see https://dictionaryapi.com/products/api-collegiate-thesaurus
 */
function extractThesaurusFromEntry(entry: unknown): {
  synonymsCore: string[];
  synonymsRelated: string[];
  antonyms: string[];
  collocations: string[];
} {
  const synonymsCore = new Set<string>();
  const synonymsRelated = new Set<string>();
  const antonyms = new Set<string>();
  const collocations = new Set<string>();

  if (entry && typeof entry === "object" && "meta" in entry) {
    const flat = flattenMetaSynAntStrings(
      (entry as { meta: unknown }).meta
    );
    flat.synonyms.forEach((s) => synonymsCore.add(s));
    flat.antonyms.forEach((a) => antonyms.add(a));
  }

  function walk(n: unknown): void {
    if (n == null) return;
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    if (typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    processWdListArrays(o.syn_list, synonymsCore);
    processWdListArrays(o.sim_list, synonymsCore);
    processWdListArrays(o.rel_list, synonymsRelated);
    processWdListArrays(o.ant_list, antonyms);
    processWdListArrays(o.near_list, antonyms);
    processWdListArrays(o.phrase_list, collocations);
    for (const v of Object.values(o)) walk(v);
  }

  walk(entry);

  return {
    synonymsCore: [...synonymsCore],
    synonymsRelated: [...synonymsRelated],
    antonyms: [...antonyms],
    collocations: [...collocations],
  };
}

async function fetchMerriamThesaurusBuckets(
  lemma: string,
  excludeLemma: string
): Promise<{
  synonymsCore: string[];
  synonymsRelated: string[];
  antonyms: string[];
  collocations: string[];
}> {
  const key = getThesaurusApiKey();
  if (!key) {
    return {
      synonymsCore: [],
      synonymsRelated: [],
      antonyms: [],
      collocations: [],
    };
  }

  const w = lemma.trim().toLowerCase();
  const avoid = excludeLemma.trim().toLowerCase();
  if (!w) {
    return {
      synonymsCore: [],
      synonymsRelated: [],
      antonyms: [],
      collocations: [],
    };
  }

  const entries = await fetchEntriesFromReference(THESAURUS_URL, w, key).catch(
    () => null
  );
  if (!entries?.length) {
    return {
      synonymsCore: [],
      synonymsRelated: [],
      antonyms: [],
      collocations: [],
    };
  }

  const synCore = new Set<string>();
  const synRel = new Set<string>();
  const antAcc = new Set<string>();
  const phAcc = new Set<string>();

  for (const entry of entries) {
    const b = extractThesaurusFromEntry(entry);
    for (const s of b.synonymsCore) synCore.add(s);
    for (const s of b.synonymsRelated) synRel.add(s);
    for (const a of b.antonyms) antAcc.add(a);
    for (const p of b.collocations) phAcc.add(p);
  }

  const filterAvoid = (items: Iterable<string>) =>
    [...items].filter((x) => x.trim().toLowerCase() !== avoid);

  return {
    synonymsCore: filterAvoid(synCore).slice(0, 36),
    synonymsRelated: filterAvoid(synRel).slice(0, 36),
    antonyms: filterAvoid(antAcc).slice(0, 32),
    collocations: filterAvoid(phAcc).slice(0, 28),
  };
}

function mergeUniqueExcludeLemma(
  lemmaLower: string,
  buckets: string[][],
  cap: number
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  outer: for (const bucket of buckets) {
    for (const raw of bucket) {
      const t = stripMerriamWebsterMarkup(String(raw)).trim();
      const k = t.toLowerCase();
      if (k.length < 2 || k === lemmaLower || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= cap) break outer;
    }
  }
  return out;
}

/**
 * Learner's only: `meta["app-shortdef"].def[]` gloss strings when full `shortdef`/`def` are sparse.
 * @see MW JSON §4.1 Entry Metadata: app-shortdef
 */
function extractAppShortdefDefs(meta: MerriamWebsterEntry["meta"]): string[] {
  if (!meta || typeof meta !== "object") return [];
  const raw = (meta as Record<string, unknown>)["app-shortdef"];
  const out: string[] = [];

  const pushDefArray = (def: unknown) => {
    if (!Array.isArray(def)) return;
    for (const x of def) {
      if (typeof x !== "string") continue;
      const t = stripMerriamWebsterMarkup(x).trim();
      if (t.length > 2) out.push(t);
    }
  };

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    pushDefArray((raw as { def?: unknown }).def);
  }
  if (Array.isArray(raw)) {
    for (const block of raw) {
      if (block && typeof block === "object") {
        pushDefArray((block as { def?: unknown }).def);
      }
    }
  }
  return out;
}

/** Collegiate `suppl.ldq.def[].sseq` — learner-style quotient senses bundled under main entry (MW JSON). */
function extractSupplementalLdSense(
  entry: MerriamWebsterEntry,
  defs: string[],
  examples: string[]
): void {
  const ldq = entry.suppl?.ldq;
  if (!ldq?.def || !Array.isArray(ldq.def)) return;
  for (const block of ldq.def) {
    if (block?.sseq) walkSenseTree(block.sseq, defs, examples);
  }
}

/** Collegiate `suppl.examples[].t` verbal illustrations (MW JSON). */
function extractSupplementalExamples(entry: MerriamWebsterEntry): string[] {
  const examples = entry.suppl?.examples;
  if (!Array.isArray(examples)) return [];
  const out: string[] = [];
  for (const ex of examples) {
    if (!ex || typeof ex !== "object" || typeof ex.t !== "string") continue;
    const t = stripMerriamWebsterMarkup(ex.t).trim();
    if (t.length > 2) out.push(t);
  }
  return out;
}

/** Defined run-on phrases (`dros`) can carry sense trees with defs/examples (Learner's). */
function parseDrosBlocks(
  dros: MerriamWebsterEntry["dros"],
  defs: string[],
  examples: string[]
) {
  for (const dro of dros ?? []) {
    for (const block of dro.def ?? []) {
      walkSenseTree(block.sseq, defs, examples);
    }
  }
}

function collectFromDt(dt: unknown[], defs: string[], examples: string[]) {
  if (!Array.isArray(dt)) return;
  for (const item of dt) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const [kind, payload] = item;
    if (kind === "text" && typeof payload === "string") {
      const t = stripMerriamWebsterMarkup(payload);
      if (t.length > 2) defs.push(t);
    } else if (kind === "vis" && Array.isArray(payload)) {
      for (const v of payload) {
        if (v && typeof v === "object" && "t" in v) {
          const t = stripMerriamWebsterMarkup(String((v as { t: string }).t));
          if (t.length > 2) examples.push(t);
        }
      }
    } else if (kind === "uns" && Array.isArray(payload)) {
      for (const group of payload) {
        if (Array.isArray(group)) collectFromDt(group, defs, examples);
      }
    } else if (kind === "sdsense" && payload && typeof payload === "object") {
      const sd = payload as { dt?: unknown[] };
      if (Array.isArray(sd.dt)) collectFromDt(sd.dt, defs, examples);
    }
  }
}

function walkSenseTree(node: unknown, defs: string[], examples: string[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) walkSenseTree(child, defs, examples);
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.dt)) collectFromDt(obj.dt, defs, examples);
  if (obj.sense && typeof obj.sense === "object") {
    walkSenseTree(obj.sense, defs, examples);
  }
  if (Array.isArray(obj.sseq)) {
    for (const block of obj.sseq) walkSenseTree(block, defs, examples);
  }
}

/** `{sx|…}` links inside definition / example verbosely (Collegiate synonym paragraphs). */
function collectSxFromDt(dt: unknown[], into: Set<string>) {
  if (!Array.isArray(dt)) return;
  for (const item of dt) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const [kind, payload] = item;
    if (kind === "text" && typeof payload === "string") {
      for (const w of extractSxLemmaLinks(payload)) into.add(w.trim());
    } else if (kind === "vis" && Array.isArray(payload)) {
      for (const v of payload) {
        if (v && typeof v === "object" && "t" in v) {
          for (const w of extractSxLemmaLinks(String((v as { t: string }).t))) {
            into.add(w.trim());
          }
        }
      }
    } else if (kind === "uns" && Array.isArray(payload)) {
      for (const group of payload) {
        if (Array.isArray(group)) collectSxFromDt(group, into);
      }
    } else if (kind === "sdsense" && payload && typeof payload === "object") {
      const sd = payload as { dt?: unknown[] };
      if (Array.isArray(sd.dt)) collectSxFromDt(sd.dt, into);
    }
  }
}

function walkSenseTreeSx(node: unknown, into: Set<string>) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) walkSenseTreeSx(child, into);
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.dt)) collectSxFromDt(obj.dt, into);
  if (obj.sense && typeof obj.sense === "object") {
    walkSenseTreeSx(obj.sense, into);
  }
  if (Array.isArray(obj.sseq)) {
    for (const block of obj.sseq) walkSenseTreeSx(block, into);
  }
}

function extractSxFromDictionaryEntry(entry: MerriamWebsterEntry): string[] {
  const into = new Set<string>();
  for (const block of entry.def ?? []) {
    walkSenseTreeSx(block.sseq, into);
  }
  return [...into];
}

/**
 * Learner's idiomatic phrases: `meta.stems` multi-word entries + `dros[].drp` run-ons.
 * @see https://dictionaryapi.com/products/api-learners-dictionary
 */
function extractLearnersCollocations(entry: MerriamWebsterEntry): string[] {
  const src = entry.meta?.src;
  if (src !== "learners") return [];

  const into = new Set<string>();
  const stems = entry.meta?.stems;
  if (Array.isArray(stems)) {
    for (const s of stems) {
      if (typeof s !== "string") continue;
      const t = stripMerriamWebsterMarkup(s).trim().replace(/\s+/g, " ");
      if (t.length < 4) continue;
      if (/\s/.test(t) || t.includes("/")) into.add(t);
    }
  }

  for (const dro of entry.dros ?? []) {
    const drp = dro.drp?.trim();
    if (!drp) continue;
    const t = stripMerriamWebsterMarkup(drp).trim().replace(/\s+/g, " ");
    if (t.length > 2) into.add(t);
  }

  return [...into];
}

function parseEntry(entry: MerriamWebsterEntry): {
  defs: string[];
  examples: string[];
  ipa: string;
  part_of_speech: string;
  pronunciation_url: string | null;
  synonyms: string[];
  antonyms: string[];
} {
  const defs: string[] = [];
  const examples: string[] = [];
  const synonyms = extractTextsFromMwSynAntBlocks(entry.syns);
  const antonyms = extractTextsFromMwSynAntBlocks(entry.ants);

  const prs = entry.hwi?.prs?.[0];
  const ipa = prs?.ipa?.trim() ?? prs?.mw?.trim() ?? "";
  const audio = prs?.sound?.audio?.trim();
  const pronunciation_url = audio ? merriamWebsterAudioUrl(audio) : null;

  for (const line of extractAppShortdefDefs(entry.meta)) {
    defs.push(line);
  }

  if (Array.isArray(entry.shortdef)) {
    for (const s of entry.shortdef) {
      const t = stripMerriamWebsterMarkup(String(s));
      if (t) defs.push(t);
    }
  }

  for (const block of entry.def ?? []) {
    walkSenseTree(block.sseq, defs, examples);
  }

  parseDrosBlocks(entry.dros, defs, examples);

  for (const ex of extractSupplementalExamples(entry)) {
    examples.push(ex);
  }

  extractSupplementalLdSense(entry, defs, examples);

  return {
    defs,
    examples,
    ipa,
    part_of_speech: entry.fl?.trim() ?? "",
    pronunciation_url,
    synonyms,
    antonyms,
  };
}

/** First short definition for flashcard front hints. */
export async function fetchMerriamWebsterFirstGloss(
  lemma: string
): Promise<string | null> {
  const entries = await fetchMerriamWebsterEntries(lemma).catch(() => null);
  if (!entries?.length) return null;

  for (const entry of entries) {
    const preview = extractAppShortdefDefs(entry.meta);
    if (preview.length > 0) {
      const t = stripMerriamWebsterMarkup(preview[0]);
      if (t.length >= 2)
        return t.length > 220 ? `${t.slice(0, 217)}…` : t;
    }
    const first = entry.shortdef?.[0];
    if (!first) continue;
    const t = stripMerriamWebsterMarkup(first);
    if (t.length < 2) continue;
    return t.length > 220 ? `${t.slice(0, 217)}…` : t;
  }
  return null;
}

/** Full card enrichment: Learner's / Collegiate + optional Collegiate Thesaurus buckets. */
export async function fetchMerriamWebster(
  lemma: string
): Promise<DictionaryEnrichment | null> {
  const entries = await fetchMergedMerriamDictionaryEntries(lemma);
  if (!entries.length) return null;

  const allDefs: string[] = [];
  const allExamples: string[] = [];
  const allSyns: string[] = [];
  const allAnts: string[] = [];
  const allSx: string[] = [];
  const allLearnerCollocations: string[] = [];
  let ipa = "";
  let part_of_speech = "";
  let pronunciation_url: string | null = null;

  for (const entry of entries) {
    const parsed = parseEntry(entry);
    if (!ipa && parsed.ipa) ipa = parsed.ipa;
    if (!part_of_speech && parsed.part_of_speech)
      part_of_speech = parsed.part_of_speech;
    if (!pronunciation_url && parsed.pronunciation_url)
      pronunciation_url = parsed.pronunciation_url;
    allDefs.push(...parsed.defs);
    allExamples.push(...parsed.examples);
    allSyns.push(...parsed.synonyms);
    allAnts.push(...parsed.antonyms);
    const metaSa = flattenMetaSynAntStrings(entry.meta);
    allSyns.push(...metaSa.synonyms);
    allAnts.push(...metaSa.antonyms);
    allSx.push(...extractSxFromDictionaryEntry(entry));
    allLearnerCollocations.push(...extractLearnersCollocations(entry));
  }

  const seenDef = new Set<string>();
  const uniqueDefs: string[] = [];
  for (const d of allDefs) {
    const k = d.toLowerCase();
    if (seenDef.has(k)) continue;
    seenDef.add(k);
    uniqueDefs.push(d);
    if (uniqueDefs.length >= 8) break;
  }

  let fromAnyShortdef = "";
  for (const e of entries) {
    const first = e.shortdef?.[0];
    if (!first) continue;
    const t = stripMerriamWebsterMarkup(first).trim();
    if (t.length > 2) {
      fromAnyShortdef = t;
      break;
    }
  }

  let fromAnyAppShort = "";
  for (const e of entries) {
    const app = extractAppShortdefDefs(e.meta);
    if (!app[0]) continue;
    const t = stripMerriamWebsterMarkup(app[0]).trim();
    if (t.length > 2) {
      fromAnyAppShort = t;
      break;
    }
  }

  const definition =
    uniqueDefs.length > 0
      ? uniqueDefs.join(" · ")
      : fromAnyShortdef
        ? fromAnyShortdef
        : fromAnyAppShort;

  const example_sentences = [...new Set(allExamples)].slice(0, 6);
  const lemmaLower = lemma.trim().toLowerCase();
  const thes = await fetchMerriamThesaurusBuckets(lemma, lemma);

  const CAP_SYN = 22;
  const CAP_ANT = 16;
  const CAP_COL = 14;

  /* Precedence: MW Thesaurus first (curated synonym groups + related),
     then MW Dictionary syns/meta + cross-refs as backfill. */
  const synonyms = mergeUniqueExcludeLemma(
    lemmaLower,
    [
      thes.synonymsCore,
      thes.synonymsRelated,
      [...new Set(allSyns)],
      [...new Set(allSx)],
    ],
    CAP_SYN
  );
  /* Same precedence as synonyms: MW Thesaurus first, then MW Dictionary syns/meta. */
  const antonyms = mergeUniqueExcludeLemma(
    lemmaLower,
    [thes.antonyms, [...new Set(allAnts)]],
    CAP_ANT
  );
  /* Precedence: MW Learner's (meta.stems + dros) first, then Collegiate Thesaurus phrase_list. */
  const collocations = mergeUniqueExcludeLemma(
    lemmaLower,
    [[...new Set(allLearnerCollocations)], thes.collocations],
    CAP_COL
  );

  const hasLexical =
    definition.trim().length > 0 || example_sentences.length > 0;
  const hasRelation =
    synonyms.length > 0 ||
    antonyms.length > 0 ||
    collocations.length > 0;

  if (!hasLexical && !hasRelation) return null;

  return {
    ipa,
    definition: definition || example_sentences[0] || "",
    part_of_speech,
    example_sentences,
    synonyms,
    antonyms,
    collocations,
    pronunciation_url,
  };
}
