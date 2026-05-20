import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Always returns 200 with a JSON body so the Settings page can show *why*
 * Supabase failed (RLS, missing table, bad key, wrong URL, etc.).
 */
export async function GET() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!url.startsWith("http")) {
    return NextResponse.json({
      connected: false,
      message:
        "NEXT_PUBLIC_SUPABASE_URL is missing or invalid. It must start with https:// (place .env.local in the vocab-app folder next to package.json, then restart npm run dev).",
    });
  }

  if (!key || key.length < 20) {
    return NextResponse.json({
      connected: false,
      message:
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or too short. Paste the anon public key from Supabase → Project Settings → API.",
    });
  }

  try {
    const supabase = createClient(url, key);
    const { error } = await supabase
      .from("words")
      .select("id", { count: "exact", head: true });

    if (error) {
      let hint = "";
      if (
        error.message.includes("relation") &&
        error.message.includes("does not exist")
      ) {
        hint =
          " Run supabase-schema.sql in the Supabase SQL Editor to create the words table.";
      } else if (
        error.code === "PGRST301" ||
        error.message.toLowerCase().includes("jwt")
      ) {
        hint =
          " Check that you pasted the anon key (not the service_role key) and that the project is not paused.";
      } else if (error.code === "42501" || error.message.includes("permission")) {
        hint =
          " Row Level Security blocked the query. Re-run the policy section of supabase-schema.sql.";
      }

      return NextResponse.json({
        connected: false,
        message: error.message,
        code: error.code ?? undefined,
        hint: hint || undefined,
      });
    }

    return NextResponse.json({ connected: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({
      connected: false,
      message: msg,
      hint: "Check the URL is your Supabase REST URL (…supabase.co) and that the dev server was restarted after editing .env.local.",
    });
  }
}
