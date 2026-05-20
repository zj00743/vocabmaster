import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  isValidExportScope,
  joinCsvRow,
  VOCAB_EXPORT_HEADERS,
  wordToExportRow,
  type VocabExportScope,
} from "@/lib/csv";

const PAGE_SIZE = 1000;

async function fetchWordsForScope(scope: VocabExportScope) {
  const rows: Record<string, unknown>[] = [];

  if (scope === "my_words") {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("learning_progress")
        .select("word:words!inner(*)")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(error.message);
      const batch = (data ?? [])
        .map((row) => {
          const w = row.word;
          return w && typeof w === "object" ? (w as Record<string, unknown>) : null;
        })
        .filter((w): w is Record<string, unknown> => Boolean(w));
      rows.push(...batch);
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    rows.sort((a, b) => {
      const ra = a.rank != null ? Number(a.rank) : Number.MAX_SAFE_INTEGER;
      const rb = b.rank != null ? Number(b.rank) : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.word).localeCompare(String(b.word));
    });
    return rows;
  }

  let from = 0;
  while (true) {
    let query = supabase
      .from("words")
      .select("*")
      .order("rank", { ascending: true, nullsFirst: false })
      .order("word", { ascending: true });

    if (scope === "corpus") {
      query = query.eq("is_custom", false);
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (data?.length) rows.push(...data);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const scopeParam = request.nextUrl.searchParams.get("scope") ?? "all";
    const scope: VocabExportScope = isValidExportScope(scopeParam)
      ? scopeParam
      : "all";

    const words = await fetchWordsForScope(scope);

    const lines = [
      joinCsvRow([...VOCAB_EXPORT_HEADERS]),
      ...words.map((w) => joinCsvRow(wordToExportRow(w))),
    ];
    const csv = lines.join("\n");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `vocab-${scope}-${date}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
