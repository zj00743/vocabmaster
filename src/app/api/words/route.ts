import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  type FrequencyBand,
  type WordSort,
  isValidFrequencyBand,
  isValidWordSort,
} from "@/lib/frequency-rank";
import {
  type DateAddedFilter,
  dateAddedFilterBounds,
  isValidDateAddedFilter,
} from "@/lib/date-added-filter";
import {
  type EntryTypeFilter,
  applyEntryTypeFilter,
  isValidEntryTypeFilter,
  normalizeEntryTypeFilter,
  normalizeEntryTypeForStorage,
} from "@/lib/word-entry";
import {
  attachTagsToWords,
  getTagsForWord,
  getWordIdsForTagFilter,
  setWordTags,
} from "@/lib/tag-db";

function applyFrequencyBandFilter<
  Q extends {
    gte: (col: string, val: number) => Q;
    lte: (col: string, val: number) => Q;
    gt: (col: string, val: number) => Q;
  },
>(query: Q, band: FrequencyBand, column = "rank"): Q {
  switch (band) {
    case "1-4k":
      return query.gte(column, 1).lte(column, 4000);
    case "4k-10k":
      return query.gt(column, 4000).lte(column, 10000);
    case "10k-25k":
      return query.gt(column, 10000).lte(column, 25000);
    case "25k+":
      return query.gt(column, 25000);
    default:
      return query;
  }
}

function applyFrequencyFilter<
  Q extends {
    gte: (col: string, val: number) => Q;
    lte: (col: string, val: number) => Q;
    gt: (col: string, val: number) => Q;
    is: (col: string, val: null) => Q;
  },
>(query: Q, band: FrequencyBand, column = "rank"): Q {
  if (band === "all") return query;
  if (band === "custom") return query.is(column, null);
  return applyFrequencyBandFilter(query, band, column);
}

/**
 * List words in the user's book (has learning_progress).
 * Queries from `learning_progress` so we can order by `created_at` /
 * `last_reviewed` natively (Supabase's `foreignTable` order only reorders the
 * embedded array, not the parent rows — that broke "Recently added" / "Recently
 * reviewed" when the query was rooted on `words`).
 */
async function getMyWords(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;
  const q = params.get("q")?.trim() ?? "";
  const status = params.get("status");
  const tagId = params.get("tag_id")?.trim() ?? "";
  const frequencyParam = params.get("frequency") ?? "all";
  const entryTypeParam = params.get("entry_type") ?? "all";
  const sortParam = params.get("sort") ?? "added";
  const dateAddedParam = params.get("date_added") ?? "all";
  const frequency: FrequencyBand = isValidFrequencyBand(frequencyParam)
    ? frequencyParam
    : "all";
  const entryType: EntryTypeFilter = isValidEntryTypeFilter(entryTypeParam)
    ? normalizeEntryTypeFilter(entryTypeParam)
    : "all";
  const sort: WordSort = isValidWordSort(sortParam) ? sortParam : "added";
  const dateAdded: DateAddedFilter = isValidDateAddedFilter(dateAddedParam)
    ? dateAddedParam
    : "all";
  const effectiveFrequency =
    entryType === "expression" ? ("all" as const) : frequency;

  const idsOnly =
    params.get("ids_only") === "1" || params.get("ids_only") === "true";

  let query = supabase
    .from("learning_progress")
    .select(
      idsOnly
        ? `word_id, word:words!inner(id)`
        : `*, word:words!inner(*)`,
      { count: "exact" }
    );

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    query = query.ilike("word.word", `%${q}%`);
  }

  if (tagId && tagId !== "all") {
    const wordIds = await getWordIdsForTagFilter(tagId);
    if (wordIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 0,
        },
      });
    }
    query = query.in("word_id", wordIds);
  }

  query = applyEntryTypeFilter(query, entryType, "word.entry_type");

  if (effectiveFrequency !== "all") {
    query = applyFrequencyFilter(query, effectiveFrequency, "word.rank");
  }

  const addedBounds = dateAddedFilterBounds(dateAdded);
  if (addedBounds?.gte) {
    query = query.gte("created_at", addedBounds.gte);
  }
  if (addedBounds?.lt) {
    query = query.lt("created_at", addedBounds.lt);
  }

  /* `ids_only` short-circuits sort + pagination — used by bulk-select "all filtered". */
  if (idsOnly) {
    const { data, error, count } = await query.range(0, 4999);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const ids = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const w = row.word as { id?: unknown } | null;
        return typeof w?.id === "string" ? w.id : null;
      })
      .filter((x): x is string => Boolean(x));
    return NextResponse.json({ ids, total: count ?? ids.length });
  }

  /* Order parent `learning_progress` rows — use `word(col)` not `referencedTable`
     (referencedTable only reorders the embedded array). */
  if (sort === "alpha") {
    query = query.order("word(word)", { ascending: true });
  } else if (sort === "added") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "last_reviewed") {
    query = query.order("last_reviewed", {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    query = query
      .order("word(rank)", { ascending: true, nullsFirst: false })
      .order("word(word)", { ascending: true });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? [])
    .map((row: Record<string, unknown>) => {
      const w = row.word;
      if (!w || typeof w !== "object") return null;
      const wordFields = w as Record<string, unknown> & { id: string };
      return {
        ...wordFields,
        progress: {
          id: row.id,
          word_id: row.word_id,
          status: row.status,
          difficulty: row.difficulty,
          stability: row.stability,
          next_review: row.next_review,
          last_reviewed: row.last_reviewed,
          review_count: row.review_count,
          created_at: row.created_at,
        },
      };
    })
    .filter(Boolean) as { id: string }[];

  const withTags = await attachTagsToWords(results);

  return NextResponse.json({
    data: withTags,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  });
}

/** List vocabulary corpus (e.g. browse by tag). */
async function getCorpusWords(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tagId = params.get("tag_id")?.trim() ?? "";
  const status = params.get("status");
  const q = params.get("q")?.trim() ?? "";
  const frequencyParam = params.get("frequency") ?? "all";
  const entryTypeParam = params.get("entry_type") ?? "all";
  const sortParam = params.get("sort") ?? "frequency";
  const frequency: FrequencyBand = isValidFrequencyBand(frequencyParam)
    ? frequencyParam
    : "all";
  const entryType: EntryTypeFilter = isValidEntryTypeFilter(entryTypeParam)
    ? normalizeEntryTypeFilter(entryTypeParam)
    : "all";
  const sort: WordSort = isValidWordSort(sortParam) ? sortParam : "frequency";
  const effectiveFrequency =
    entryType === "expression" ? ("all" as const) : frequency;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabase.from("words").select(
    `
        *,
        progress:learning_progress(*)
      `,
    { count: "exact" }
  );

  let tagWordIds: string[] | null = null;
  if (tagId && tagId !== "all") {
    tagWordIds = await getWordIdsForTagFilter(tagId);
    if (tagWordIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      });
    }
    query = query.in("id", tagWordIds);
  }

  if (q) {
    query = query.ilike("word", `%${q}%`);
  }

  query = applyEntryTypeFilter(query, entryType, "entry_type");

  if (effectiveFrequency !== "all") {
    query = applyFrequencyFilter(query, effectiveFrequency);
  }

  if (sort === "alpha") {
    query = query.order("word", { ascending: true });
  } else {
    query = query
      .order("rank", { ascending: true, nullsFirst: false })
      .order("word", { ascending: true });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* PostgREST returns the embed as an OBJECT when the FK column is uniquely
     indexed (we have UNIQUE(word_id) on learning_progress), and as an ARRAY
     otherwise. Accept both shapes. */
  let results = (data ?? []).map((item) => {
    const raw = (item as Record<string, unknown>).progress;
    const progress = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
    return { ...item, progress };
  });

  if (status) {
    results = results.filter((item) => {
      if (status === "new") return !item.progress;
      return item.progress?.status === status;
    });
  }

  const withTags = await attachTagsToWords(
    results as { id: string }[]
  );

  return NextResponse.json({
    data: withTags,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const inMyWords = request.nextUrl.searchParams.get("in_my_words");
    if (inMyWords === "1" || inMyWords === "true") {
      return await getMyWords(request);
    }
    return await getCorpusWords(request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { word, definition, translation_zh, ipa, part_of_speech } = body;

    if (!word || typeof word !== "string" || !word.trim()) {
      return NextResponse.json(
        { error: 'Field "word" (non-empty string) is required' },
        { status: 400 }
      );
    }

    const entry_type = normalizeEntryTypeForStorage(body.entry_type, word);
    const show_image =
      typeof body.show_image === "boolean" ? body.show_image : null;

    const { data, error } = await supabase
      .from("words")
      .insert({
        word: word.trim(),
        entry_type,
        show_image,
        definition: definition ?? "",
        translation_zh: translation_zh ?? "",
        ipa: ipa ?? "",
        part_of_speech: part_of_speech ?? "",
        example_sentences: body.example_sentences ?? [],
        synonyms: body.synonyms ?? [],
        antonyms: body.antonyms ?? [],
        collocations: body.collocations ?? [],
        image_url: body.image_url ?? null,
        image_prompt: body.image_prompt ?? null,
        mnemonic: body.mnemonic ?? null,
        rank: body.rank ?? null,
        word_family: body.word_family ?? null,
        is_custom: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tagIds = Array.isArray(body.tag_ids)
      ? body.tag_ids.filter((x: unknown) => typeof x === "string")
      : [];
    if (tagIds.length > 0) {
      await setWordTags(data.id, tagIds);
    }

    const tags =
      tagIds.length > 0 ? await getTagsForWord(data.id) : [];
    return NextResponse.json({ ...data, tags }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
