"use client";

import { Badge } from "@/components/ui/badge";
import { CocaRankBadge } from "@/components/coca-rank-badge";
import {
  isInCocaBank,
  resolveEntryType,
  entryTypeBadgeLabel,
} from "@/lib/word-entry";
import { cn } from "@/lib/utils";

/** CoCA rank when in the bank; otherwise a Custom label. */
export function CocaOrCustomBadge({
  rank,
  className,
}: {
  rank: number | null | undefined;
  className?: string;
}) {
  if (isInCocaBank(rank)) {
    return <CocaRankBadge rank={rank} className={className} />;
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-sans font-normal shrink-0", className)}
    >
      Custom
    </Badge>
  );
}

/**
 * Single source of truth for the entry's type/frequency badge. Precedence:
 * sentence pattern → phrase → CoCA rank → Custom.
 */
export function WordTypeBadge({
  word,
  rank,
  entryType,
  className,
}: {
  word: string;
  rank: number | null | undefined;
  entryType?: string | null;
  className?: string;
}) {
  const type = resolveEntryType(word, entryType);

  if (type === "sentence_pattern" || type === "phrase") {
    return (
      <Badge
        variant="outline"
        className={cn("font-sans font-normal shrink-0", className)}
      >
        {entryTypeBadgeLabel(type)}
      </Badge>
    );
  }

  if (isInCocaBank(rank)) {
    return <CocaRankBadge rank={rank} className={className} />;
  }

  return (
    <Badge
      variant="outline"
      className={cn("font-sans font-normal shrink-0", className)}
    >
      Custom
    </Badge>
  );
}
