import { NextRequest, NextResponse } from "next/server";
import type { CollectionsImportRow } from "@/lib/collections-import-csv";
import { importRowsToCollections } from "@/lib/collections-import";

function isImportRow(value: unknown): value is CollectionsImportRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.word === "string" && row.word.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows provided. Expected { rows: [...] }' },
        { status: 400 }
      );
    }

    const valid = rows.filter(isImportRow) as CollectionsImportRow[];
    if (valid.length === 0) {
      return NextResponse.json(
        { error: "No valid rows with a word column were found." },
        { status: 400 }
      );
    }

    const result = await importRowsToCollections(valid);

    return NextResponse.json({
      success: result.added > 0 || result.already_in_collection > 0,
      ...result,
    });
  } catch (error) {
    console.error("Collections import error:", error);
    return NextResponse.json(
      { error: "Failed to import collections" },
      { status: 500 }
    );
  }
}
