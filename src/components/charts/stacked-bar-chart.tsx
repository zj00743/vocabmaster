"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface StackSegment {
  key: string;
  label: string;
  color: string;
}

interface StackedRow {
  label: string;
  /** Per-segment counts keyed by segment.key. */
  values: Record<string, number>;
}

interface StackedBarChartProps {
  rows: StackedRow[];
  segments: StackSegment[];
  /** Layout: "horizontal" stacks left→right; "vertical" stacks bottom→top. */
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Bar thickness in px (height for horizontal, width for vertical). */
  thickness?: number;
  unitLabel?: string;
  /** When true, show counts as % of row total inside the bar (only horizontal). */
  showPercents?: boolean;
}

/** Pure CSS/flex stacked bar — works for cohort-by-month and CoCA-by-stage. */
export function StackedBarChart({
  rows,
  segments,
  orientation = "horizontal",
  className,
  thickness = 22,
  unitLabel = "words",
  showPercents = false,
}: StackedBarChartProps) {
  const rowTotals = rows.map((r) =>
    segments.reduce((acc, s) => acc + (r.values[s.key] ?? 0), 0)
  );
  const globalMax = Math.max(1, ...rowTotals);

  if (orientation === "vertical") {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-end gap-1 h-48">
          {rows.map((r, idx) => {
            const total = rowTotals[idx];
            return (
              <div
                key={r.label}
                className="flex flex-col items-center justify-end flex-1 min-w-0 h-full"
              >
                <div className="text-[10px] text-muted-foreground tabular-nums mb-1">
                  {total > 0 ? total : ""}
                </div>
                <div
                  className="w-full flex flex-col-reverse rounded-sm overflow-hidden bg-muted/40"
                  style={{ height: `${(total / globalMax) * 100}%` }}
                  title={`${r.label}: ${total} ${unitLabel}`}
                >
                  {segments.map((seg) => {
                    const v = r.values[seg.key] ?? 0;
                    if (v <= 0) return null;
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    return (
                      <div
                        key={seg.key}
                        style={{
                          height: `${pct}%`,
                          background: seg.color,
                        }}
                        title={`${seg.label}: ${v} ${unitLabel}`}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                  {r.label}
                </div>
              </div>
            );
          })}
        </div>
        <Legend segments={segments} className="mt-3" />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-2">
        {rows.map((r, idx) => {
          const total = rowTotals[idx];
          const widthPct = (total / globalMax) * 100;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <div className="w-20 shrink-0 text-xs text-muted-foreground truncate">
                {r.label}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="flex rounded-sm overflow-hidden bg-muted/40"
                  style={{
                    height: thickness,
                    width: `${Math.max(0.5, widthPct)}%`,
                  }}
                >
                  {segments.map((seg) => {
                    const v = r.values[seg.key] ?? 0;
                    if (v <= 0) return null;
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    return (
                      <div
                        key={seg.key}
                        className="flex items-center justify-center text-[10px] font-medium text-white/90"
                        style={{
                          width: `${pct}%`,
                          background: seg.color,
                          minWidth: 0,
                        }}
                        title={`${seg.label}: ${v} ${unitLabel}`}
                      >
                        {showPercents && pct >= 12 ? `${Math.round(pct)}%` : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {total}
              </div>
            </div>
          );
        })}
      </div>
      <Legend segments={segments} className="mt-3" />
    </div>
  );
}

function Legend({
  segments,
  className,
}: {
  segments: StackSegment[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs",
        className
      )}
    >
      {segments.map((s) => (
        <Fragment key={s.key}>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
