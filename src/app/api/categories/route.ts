import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const inMyWords =
      request.nextUrl.searchParams.get("in_my_words") === "1" ||
      request.nextUrl.searchParams.get("in_my_words") === "true";

    let data: { category: string | null }[] | null = null;
    let error: { message: string } | null = null;

    if (inMyWords) {
      const result = await supabase
        .from("learning_progress")
        .select("words(category)");
      data = (result.data ?? []).map((row) => {
        const raw = row.words;
        const w = Array.isArray(raw) ? raw[0] : raw;
        return {
          category:
            w && typeof w === "object" && "category" in w
              ? (w as { category: string | null }).category
              : null,
        };
      });
      error = result.error;
    } else {
      const result = await supabase.from("words").select("category");
      data = result.data;
      error = result.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      const cat = row.category;
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });

    const result = Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
