"use client";

import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WordCardEditSectionId } from "@/lib/word-card-edit-types";

export function SectionEditActions({
  isEditing,
  disabledStart,
  saving,
  onEdit,
  onSave,
  onCancel,
}: {
  isEditing: boolean;
  disabledStart?: boolean;
  saving?: boolean;
  onEdit: () => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 font-sans text-xs"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 px-2.5 font-sans text-xs"
          onClick={() => void onSave()}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 size-7 text-muted-foreground hover:text-foreground"
      onClick={onEdit}
      disabled={disabledStart}
      aria-label="Edit section"
    >
      <Pencil className="size-3.5" aria-hidden />
    </Button>
  );
}

export function sectionEditBlocked(
  active: WordCardEditSectionId | null,
  id: WordCardEditSectionId
): boolean {
  return active !== null && active !== id;
}
