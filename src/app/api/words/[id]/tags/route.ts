import { NextRequest, NextResponse } from "next/server";
import { getTagsForWord, setWordTags } from "@/lib/tag-db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tags = await getTagsForWord(id);
    return NextResponse.json(tags);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tagIds = Array.isArray(body.tag_ids)
      ? body.tag_ids.filter((x: unknown) => typeof x === "string")
      : [];
    const tags = await setWordTags(id, tagIds);
    return NextResponse.json(tags);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
