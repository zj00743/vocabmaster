import { NextRequest, NextResponse } from "next/server";
import { resolveDictionaryHint } from "@/lib/edu-dictionary-hint";

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word")?.trim();
  if (!word || word.length > 120) {
    return NextResponse.json(
      { error: 'Query "word" is required (max 120 chars).' },
      { status: 400 }
    );
  }

  try {
    const { hint, source } = await resolveDictionaryHint(word);
    return NextResponse.json({ hint, source });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Hint lookup failed", hint: null, source: "none" },
      { status: 500 }
    );
  }
}
