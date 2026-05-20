import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Remove one or many words from the learner's collection
 * (deletes the matching `learning_progress` rows; word rows themselves are kept).
 *
 * Accepts either:
 *   { word_id: "<uuid>" }            — single word, kept for backwards compatibility
 *   { word_ids: ["<uuid>", ...] }    — bulk delete
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      word_id?: unknown;
      word_ids?: unknown;
    };

    const collected: string[] = [];
    if (typeof body.word_id === "string" && body.word_id.trim()) {
      collected.push(body.word_id.trim());
    }
    if (Array.isArray(body.word_ids)) {
      for (const id of body.word_ids) {
        if (typeof id === "string" && id.trim()) collected.push(id.trim());
      }
    }

    const ids = [...new Set(collected)];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Provide word_id or word_ids" },
        { status: 400 }
      );
    }

    const { error, count } = await supabase
      .from("learning_progress")
      .delete({ count: "exact" })
      .in("word_id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* Mark each removed word as user-excluded so the /api/review new-card
       filler never re-suggests them. A separate table (instead of a column
       on `words`) keeps user state isolated from the shared corpus, and a
       PK on word_id makes the upsert idempotent. */
    const { error: excludeError } = await supabase
      .from("excluded_from_review")
      .upsert(
        ids.map((word_id) => ({ word_id, excluded_at: new Date().toISOString() })),
        { onConflict: "word_id" }
      );
    if (excludeError) {
      /* Don't fail the request — the primary delete already succeeded. Just
         log so it's visible in the dev console. */
      console.error("[progress/remove] excluded_from_review upsert failed:", excludeError);
    }

    return NextResponse.json({
      success: true,
      removed: count ?? ids.length,
      requested: ids.length,
      excluded_saved: excludeError == null,
      ...(excludeError ? { exclusion_error: excludeError.message } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
