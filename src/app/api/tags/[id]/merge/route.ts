import { NextRequest, NextResponse } from "next/server";
import { mergeTags } from "@/lib/tag-db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const body = await request.json();
    const targetId =
      typeof body.target_tag_id === "string" ? body.target_tag_id.trim() : "";
    if (!targetId) {
      return NextResponse.json(
        { error: "target_tag_id is required" },
        { status: 400 }
      );
    }
    await mergeTags(sourceId, targetId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const status = msg.includes("Cannot") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
