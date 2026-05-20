"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  type Granularity,
  bucketKey,
  bucketKeyRange,
  formatBucketLabel,
  rangeForGranularity,
} from "@/lib/analytics";

interface DailyEntry {
  date: string;
  value: number;
}

interface TimeSeriesChartProps {
  /** Daily entries (covering at least the requested range). */
  data: DailyEntry[];
  granularity: Granularity;
  /** "bar" or "line" rendering. */
  variant: "bar" | "line";
  color: string;
  unitLabel?: string;
  className?: string;
  /** Height in pixels for the plot body. */
  height?: number;
}

/** Self-contained SVG bar / line chart aggregating daily data into buckets. */
export function TimeSeriesChart({
  data,
  granularity,
  variant,
  color,
  unitLabel = "items",
  className,
  height = 200,
}: TimeSeriesChartProps) {
  const { buckets, maxValue, totals } = useMemo(() => {
    const { start, end } = rangeForGranularity(granularity);
    const keys = bucketKeyRange(start, end, granularity);

    const sums = new Map<string, number>();
    keys.forEach((k) => sums.set(k, 0));
    for (const entry of data) {
      const [y, m, d] = entry.date.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (date < start || date > end) continue;
      const key = bucketKey(date, granularity);
      if (sums.has(key)) {
        sums.set(key, (sums.get(key) ?? 0) + entry.value);
      }
    }
    const bucketsArr = keys.map((k) => ({
      key: k,
      label: formatBucketLabel(k, granularity),
      value: sums.get(k) ?? 0,
    }));
    const maxVal = Math.max(0, ...bucketsArr.map((b) => b.value));
    const total = bucketsArr.reduce((acc, b) => acc + b.value, 0);
    return { buckets: bucketsArr, maxValue: maxVal, totals: total };
  }, [data, granularity]);

  const padding = { top: 16, right: 8, bottom: 22, left: 28 };
  const innerH = height - padding.top - padding.bottom;
  const yMax = Math.max(1, niceMax(maxValue));

  /* Sparse x-axis labels: pick at most ~6 evenly-spaced ticks. */
  const tickIndexes = useMemo(() => {
    const desired = 6;
    const step = Math.max(1, Math.ceil(buckets.length / desired));
    const arr: number[] = [];
    for (let i = 0; i < buckets.length; i += step) arr.push(i);
    if (arr[arr.length - 1] !== buckets.length - 1) arr.push(buckets.length - 1);
    return arr;
  }, [buckets.length]);

  /* Compute layout values for both variants in viewBox-units = bucket count. */
  const colCount = Math.max(1, buckets.length);

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${100 * colCount + padding.left + padding.right} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Y grid lines + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding.top + innerH * (1 - t);
          const label = Math.round(yMax * t);
          return (
            <g key={t}>
              <line
                x1={padding.left}
                x2={100 * colCount + padding.left}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={padding.left - 4}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                fillOpacity={0.5}
                style={{ fontFamily: "inherit" }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Plot body */}
        {variant === "bar" &&
          buckets.map((b, i) => {
            const h = innerH * (b.value / yMax);
            const x = padding.left + i * 100 + 12;
            const y = padding.top + innerH - h;
            const w = 76;
            return (
              <g key={b.key}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={Math.max(0, h)}
                  fill={color}
                  rx={3}
                >
                  <title>
                    {b.label}: {b.value} {unitLabel}
                  </title>
                </rect>
              </g>
            );
          })}

        {variant === "line" && (
          <>
            <path
              d={areaPath(buckets, padding.left, padding.top, innerH, yMax)}
              fill={color}
              fillOpacity={0.12}
            />
            <path
              d={linePath(buckets, padding.left, padding.top, innerH, yMax)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {buckets.map((b, i) => {
              const cx = padding.left + i * 100 + 50;
              const cy = padding.top + innerH * (1 - b.value / yMax);
              return (
                <circle
                  key={b.key}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={color}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {b.label}: {b.value} {unitLabel}
                  </title>
                </circle>
              );
            })}
          </>
        )}

        {/* X-axis labels (sparse) */}
        {tickIndexes.map((i) => {
          const x = padding.left + i * 100 + 50;
          return (
            <text
              key={i}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.6}
              style={{ fontFamily: "inherit" }}
            >
              {buckets[i].label}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
        Total in range: <span className="font-semibold text-foreground">{totals}</span>{" "}
        {unitLabel}
      </div>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const ratio = v / exp;
  let nice: number;
  if (ratio <= 1) nice = 1;
  else if (ratio <= 2) nice = 2;
  else if (ratio <= 5) nice = 5;
  else nice = 10;
  return nice * exp;
}

function linePath(
  buckets: { value: number }[],
  left: number,
  top: number,
  innerH: number,
  yMax: number
): string {
  return buckets
    .map((b, i) => {
      const x = left + i * 100 + 50;
      const y = top + innerH * (1 - b.value / yMax);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function areaPath(
  buckets: { value: number }[],
  left: number,
  top: number,
  innerH: number,
  yMax: number
): string {
  if (buckets.length === 0) return "";
  const last = buckets.length - 1;
  const x0 = left + 50;
  const xLast = left + last * 100 + 50;
  const baseY = top + innerH;
  return (
    `M${x0},${baseY} ` +
    buckets
      .map((b, i) => {
        const x = left + i * 100 + 50;
        const y = top + innerH * (1 - b.value / yMax);
        return `L${x},${y}`;
      })
      .join(" ") +
    ` L${xLast},${baseY} Z`
  );
}
