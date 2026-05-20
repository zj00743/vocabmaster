"use client";

import { cn } from "@/lib/utils";

interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  className?: string;
  centerLabel?: string;
  centerValue?: string | number;
}

/** Simple SVG donut. */
export function DonutChart({
  slices,
  size = 160,
  className,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const radius = size / 2;
  const innerR = radius * 0.62;
  const cx = radius;
  const cy = radius;

  let start = -Math.PI / 2; // start at top
  const arcs = slices.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const end = start + frac * Math.PI * 2;
    const arc = {
      key: s.key,
      label: s.label,
      value: s.value,
      color: s.color,
      d: arcPath(cx, cy, radius, innerR, start, end),
    };
    start = end;
    return arc;
  });

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {total === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={radius - 1}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={radius - innerR}
            />
          ) : (
            arcs.map((a) => (
              <path key={a.key} d={a.d} fill={a.color}>
                <title>
                  {a.label}: {a.value}
                </title>
              </path>
            ))
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {centerValue != null && (
            <div className="text-xl font-bold tabular-nums leading-none">
              {centerValue}
            </div>
          )}
          {centerLabel && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {centerLabel}
            </div>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="text-muted-foreground min-w-16">{s.label}</span>
              <span className="font-semibold tabular-nums">{s.value}</span>
              <span className="text-muted-foreground tabular-nums">({pct}%)</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number
): string {
  /* Full ring as two half-circles when there's only one slice (== 100%). */
  if (Math.abs(end - start) >= Math.PI * 2 - 1e-6) {
    return [
      `M ${cx + rOuter} ${cy}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx - rOuter} ${cy}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx + rOuter} ${cy}`,
      `M ${cx + rInner} ${cy}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy}`,
      "Z",
    ].join(" ");
  }

  const largeArc = end - start > Math.PI ? 1 : 0;
  const x1 = cx + rOuter * Math.cos(start);
  const y1 = cy + rOuter * Math.sin(start);
  const x2 = cx + rOuter * Math.cos(end);
  const y2 = cy + rOuter * Math.sin(end);
  const x3 = cx + rInner * Math.cos(end);
  const y3 = cy + rInner * Math.sin(end);
  const x4 = cx + rInner * Math.cos(start);
  const y4 = cy + rInner * Math.sin(start);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}
