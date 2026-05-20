"use client";

import { cn } from "@/lib/utils";
import { heatmapClass } from "@/lib/analytics";

interface HourHeatmapProps {
  /** 7 rows (Mon=0 … Sun=6) × 24 hour columns of review counts. */
  matrix: number[][];
  /** Optional max override; defaults to the matrix max. */
  max?: number;
  className?: string;
  unitLabel?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HourHeatmap({
  matrix,
  max,
  className,
  unitLabel = "reviews",
}: HourHeatmapProps) {
  const computedMax = max ?? matrix.reduce(
    (acc, row) => Math.max(acc, ...row),
    0
  );

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="inline-block min-w-full">
        {/* Hour header */}
        <div className="flex pl-9 mb-1 text-[10px] text-muted-foreground">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="w-4 mr-[2px] text-left shrink-0">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {matrix.map((row, dow) => (
          <div key={dow} className="flex items-center">
            <div className="w-9 pr-1 text-right text-[10px] text-muted-foreground">
              {DAYS[dow]}
            </div>
            <div className="flex">
              {row.map((v, h) => (
                <div
                  key={h}
                  className={cn(
                    "size-4 mr-[2px] rounded-sm border border-black/[0.02] dark:border-white/[0.04]",
                    heatmapClass(v, computedMax || 1)
                  )}
                  title={`${DAYS[dow]} ${String(h).padStart(2, "0")}:00 — ${v} ${unitLabel}`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-end gap-1 mt-2 pr-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[0, 0.15, 0.35, 0.55, 0.8, 1].map((r, i) => (
            <div
              key={i}
              className={cn(
                "size-3 rounded-sm border border-black/[0.02] dark:border-white/[0.04]",
                heatmapClass(r * (computedMax || 1), computedMax || 1)
              )}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
