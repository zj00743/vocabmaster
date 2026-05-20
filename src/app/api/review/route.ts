import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Words due for SRS review — **only from the learner's book** (`learning_progress`).
 *
 * We intentionally do NOT pull unrated vocabulary from the corpus to top up the
 * queue. That filler caused words like “a”, “the”, … to appear during Review even
 * when they were absent from My Words — confusing FSRS spacing with discovery.
 *
 * Adding words stays on Add Word / Browse; reviewing stays on what's in My Words.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10))
    );
    const now = new Date().toISOString();

    const { data: dueCards, error: dueError } = await supabase
      .from("learning_progress")
      .select(
        `
        *,
        word:words(*)
      `
      )
      .lte("next_review", now)
      .order("next_review", { ascending: true })
      .limit(limit);

    if (dueError) {
      return NextResponse.json({ error: dueError.message }, { status: 500 });
    }

    return NextResponse.json({
      cards: dueCards ?? [],
      total: dueCards?.length ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
