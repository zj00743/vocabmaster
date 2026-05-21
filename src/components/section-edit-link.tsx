import Link from "next/link";
import { Pencil } from "lucide-react";
import type { WordCardEditSectionId } from "@/lib/word-card-edit-types";
import {
  definitionEditPath,
  wordSectionEditPath,
} from "@/lib/word-section-meta";

export function SectionEditLink({
  wordId,
  sectionId,
  definitionLang,
}: {
  wordId: string;
  sectionId?: WordCardEditSectionId;
  /** When set, opens EN or 中文 definition editor (matches active Definition tab). */
  definitionLang?: "en" | "zh";
}) {
  const href = definitionLang
    ? definitionEditPath(wordId, definitionLang)
    : sectionId
      ? wordSectionEditPath(wordId, sectionId)
      : "#";
  const ariaLabel = definitionLang
    ? definitionLang === "en"
      ? "Edit English definition"
      : "Edit Chinese definition"
    : "Edit section";

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex shrink-0 size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
    >
      <Pencil className="size-3.5" aria-hidden />
    </Link>
  );
}
