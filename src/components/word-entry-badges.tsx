"use client";

import { Badge } from "@/components/ui/badge";
import { CocaRankBadge } from "@/components/coca-rank-badge";
import { isInCocaBank } from "@/lib/word-entry";
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
