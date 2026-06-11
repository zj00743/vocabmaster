import { NextRequest, NextResponse } from "next/server";
import { createTag, getTagList } from "@/lib/tag-db";

export async function GET(request: NextRequest) {
  try {
    const inMyWords =
      request.nextUrl.searchParams.get("in_my_words") === "1" ||
      request.nextUrl.searchParams.get("in_my_words") === "true";
    const tags = await getTagList(inMyWords);
    return NextResponse.json(tags);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const tag = await createTag(name);
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
