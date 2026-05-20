"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { heatmapClass } from "@/lib/analytics";

interface HeatmapEntry {
  date: string;
  value: number;
}

interface ActivityHeatmapProps {
  /** Daily entries; missing days are treated as 0. */
  data: HeatmapEntry[];
  /** Optional max override — otherwise computed from data. */
  max?: number;
  className?: string;
  /** Plain-English unit shown in the cell tooltip (e.g. "words added"). */
  unitLabel?: string;
}

/** GitHub-style activity heatmap: each column = ISO week (Sun→Sat), 53 columns. */
export function ActivityHeatmap({
  data,
  max,
  className,
  unitLabel = "items",
}: ActivityHeatmapProps) {
  const { weeks, computedMax, monthLabels } = useMemo(() => {
    const byDate = new Map(data.map((d) => [d.date, d.value]));

    /* Anchor on today and walk back 52 weeks (to the previous Sunday). */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay())); // upcoming Saturday
    const start = new Date(end);
    start.setDate(end.getDate() - 7 * 52 - 6); // 53 weeks back, Sunday

    const cols: { date: Date; iso: string; value: number }[][] = [];
    let col: { date: Date; iso: string; value: number }[] = [];
    let cur = new Date(start);
    let maxVal = 0;

    while (cur <= end) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      const value = byDate.get(iso) ?? 0;
      if (value > maxVal) maxVal = value;
      col.push({ date: new Date(cur), iso, value });
      if (col.length === 7) {
        cols.push(col);
        col = [];
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (col.length > 0) cols.push(col);

    /* Month labels: render the month name on the first column that starts a new month. */
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((c, idx) => {
      const firstOfCol = c[0]?.date;
      if (!firstOfCol) return;
      const m = firstOfCol.getMonth();
      if (m !== lastMonth) {
        labels.push({
          col: idx,
          label: firstOfCol.toLocaleDateString("en-US", { month: "short" }),
        });
        lastMonth = m;
      }
    });

    return { weeks: cols, computedMax: maxVal, monthLabels: labels };
  }, [data]);

  const effectiveMax = max ?? computedMax;
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="inline-block min-w-full">
        {/* Month header row */}
        <div className="flex pl-7 mb-1 text-[10px] text-muted-foreground">
          {weeks.map((_, i) => {
            const label = monthLabels.find((l) => l.col === i)?.label ?? "";
            return (
              <div key={i} className="w-3 mr-[2px] shrink-0 text-left">
                {label}
              </div>
            );
          })}
        </div>
        <div className="flex">
          {/* Day-of-week labels */}
          <div className="flex flex-col justify-between pr-1 text-[10px] text-muted-foreground">
            {dayLabels.map((d, i) => (
              <div key={i} className="h-3 leading-3">
                {d}
              </div>
            ))}
          </div>
          {/* Week columns */}
          <div className="flex">
            {weeks.map((week, i) => (
              <div key={i} className="flex flex-col gap-[2px] mr-[2px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cell = week[dayIdx];
                  if (!cell) {
                    return (
                      <div
                        key={dayIdx}
                        className="size-3 rounded-sm"
                        aria-hidden
                      />
                    );
                  }
                  const isFuture = cell.date > new Date();
                  const cls = isFuture
                    ? "bg-transparent"
                    : heatmapClass(cell.value, effectiveMax);
                  const dateText = cell.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        "size-3 rounded-sm border border-black/[0.02] dark:border-white/[0.04]",
                        cls
                      )}
                      title={
                        isFuture
                          ? dateText
                          : `${cell.value} ${unitLabel} · ${dateText}`
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[0, 0.15, 0.35, 0.55, 0.8, 1].map((r, i) => (
            <div
              key={i}
              className={cn(
                "size-3 rounded-sm border border-black/[0.02] dark:border-white/[0.04]",
                heatmapClass(r * (effectiveMax || 1), effectiveMax || 1)
              )}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
