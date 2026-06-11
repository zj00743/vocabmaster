import { NextRequest, NextResponse } from "next/server";
import {
  countWordLinks,
  deleteTag,
  fetchTagById,
  renameTag,
} from "@/lib/tag-db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tag = await fetchTagById(id);
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    const word_count = await countWordLinks(id);
    return NextResponse.json({ ...tag, word_count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const tag = await renameTag(id, body.name);
    return NextResponse.json(tag);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tag = await fetchTagById(id);
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    await deleteTag(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
