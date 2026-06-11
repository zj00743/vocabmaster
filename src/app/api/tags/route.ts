import { NextRequest, NextResponse } from "next/server";
import { createTag, getTagTree } from "@/lib/tag-db";

export async function GET(request: NextRequest) {
  try {
    const inMyWords =
      request.nextUrl.searchParams.get("in_my_words") === "1" ||
      request.nextUrl.searchParams.get("in_my_words") === "true";
    const tree = await getTagTree(inMyWords);
    return NextResponse.json(tree);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const parentId =
      typeof body.parent_id === "string" && body.parent_id.trim()
        ? body.parent_id.trim()
        : null;
    const tag = await createTag(name, parentId);
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
