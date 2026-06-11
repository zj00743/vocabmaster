import { NextRequest, NextResponse } from "next/server";
import {
  countDirectChildren,
  countDirectWordLinks,
  deleteTagWithMode,
  fetchAllTags,
  fetchTagById,
  moveTag,
  renameTag,
} from "@/lib/tag-db";
import { enrichTagsWithPaths, tagPathFor } from "@/lib/tags";

async function tagWithPath(id: string) {
  const tag = await fetchTagById(id);
  if (!tag) return null;
  const all = await fetchAllTags();
  const byId = new Map(all.map((t) => [t.id, t]));
  const path = tagPathFor(tag.id, byId);
  return { ...tag, path, depth: path.split("/").length - 1 };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tag = await tagWithPath(id);
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    const childCount = await countDirectChildren(id);
    const wordCount = await countDirectWordLinks(id);
    return NextResponse.json({ ...tag, child_count: childCount, word_count: wordCount });
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

    if (typeof body.name === "string") {
      const tag = await renameTag(id, body.name);
      return NextResponse.json(tag);
    }

    if ("parent_id" in body) {
      const parentId =
        typeof body.parent_id === "string" && body.parent_id.trim()
          ? body.parent_id.trim()
          : null;
      const tag = await moveTag(id, parentId);
      return NextResponse.json(tag);
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const status =
      msg.includes("already exists") || msg.includes("Cannot") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const modeParam = request.nextUrl.searchParams.get("mode");
    const moveTo = request.nextUrl.searchParams.get("move_to") ?? undefined;
    const preview = request.nextUrl.searchParams.get("preview") === "1";

    const tag = await fetchTagById(id);
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const childCount = await countDirectChildren(id);
    const wordCount = await countDirectWordLinks(id);
    const all = enrichTagsWithPaths(await fetchAllTags());
    const enriched = all.find((t) => t.id === id);

    if (preview) {
      return NextResponse.json({
        id,
        path: enriched?.path ?? tag.name,
        child_count: childCount,
        word_count: wordCount,
        can_delete_only: childCount === 0 && wordCount === 0,
      });
    }

    const mode =
      modeParam === "tag_and_children" ||
      modeParam === "move_vocab" ||
      modeParam === "tag_only"
        ? modeParam
        : childCount === 0 && wordCount === 0
          ? "tag_only"
          : null;

    if (!mode) {
      return NextResponse.json(
        {
          error: "Tag has children or vocabulary items",
          child_count: childCount,
          word_count: wordCount,
          requires_mode: true,
        },
        { status: 409 }
      );
    }

    await deleteTagWithMode(id, mode, moveTo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
