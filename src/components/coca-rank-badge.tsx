"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cocaRankLabel, cocaRankTooltip } from "@/lib/frequency-rank";
import { cn } from "@/lib/utils";

interface CocaRankBadgeProps {
  rank: number | null | undefined;
  className?: string;
}

export function CocaRankBadge({ rank, className }: CocaRankBadgeProps) {
  const label = cocaRankLabel(rank);
  const tooltip = cocaRankTooltip(rank);
  if (!label || !tooltip) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn(
              "font-normal tabular-nums cursor-default shrink-0",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
