"use client";

import { useMemo } from "react";
import type { LearningProgress } from "@/lib/types";
import {
  FSRS_REQUEST_RETENTION,
  forgettingCurveRetrievability,
} from "@/lib/fsrs";
import { cn } from "@/lib/utils";

const MS_DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.max((b.getTime() - a.getTime()) / MS_DAY, 0);
}

interface FsrsForgettingCurvePanelProps {
  progress: LearningProgress | null | undefined;
  className?: string;
}

/**
 * Compact SVG chart: FSRS retrievability R(t) vs days since last review,
 * matching the forgetting curve used when scheduling intervals.
 */
export function FsrsForgettingCurvePanel({
  progress,
  className,
}: FsrsForgettingCurvePanelProps) {
  const model = useMemo(() => {
    if (!progress) return null;

    const stability = Math.max(Number(progress.stability) || 0.1, 0.1);
    const difficulty = Number(progress.difficulty);
    const now = new Date();

    const lastReview = progress.last_reviewed
      ? new Date(progress.last_reviewed)
      : null;

    /* Days along x-axis since last recall event */
    const elapsedSinceReview = lastReview
      ? daysBetween(lastReview, now)
      : 0;

    const nextReview = progress.next_review
      ? new Date(progress.next_review)
      : null;

    /** Scheduled spacing from last review → next due (may differ slightly from displayed interval due to rounding). */
    let scheduledSpanDays: number | null = null;
    if (lastReview && nextReview) {
      scheduledSpanDays = daysBetween(lastReview, nextReview);
    }

    const xMaxRaw = Math.max(
      14,
      elapsedSinceReview * 1.35 + 5,
      scheduledSpanDays != null ? scheduledSpanDays + 7 : 0,
      stability * 8
    );
    const xMax = Math.min(Math.ceil(xMaxRaw), 365);

    const points: { x: number; r: number }[] = [];
    const STEPS = 64;
    for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * xMax;
      points.push({
        x,
        r: forgettingCurveRetrievability(x, stability),
      });
    }

    const currentR = forgettingCurveRetrievability(
      elapsedSinceReview,
      stability
    );

    return {
      stability,
      difficulty: Number.isFinite(difficulty) ? difficulty : null,
      elapsedSinceReview,
      scheduledSpanDays,
      currentR,
      xMax,
      points,
      hasRecallHistory: Boolean(lastReview),
    };
  }, [progress]);

  if (!progress || !model) return null;

  const W = 320;
  const H = 118;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xScale = (x: number) => padL + (x / model.xMax) * innerW;
  const yScale = (r: number) => padT + innerH * (1 - r);

  const pathD = model.points
    .map((p, i) => {
      const sx = xScale(p.x);
      const sy = yScale(p.r);
      return `${i === 0 ? "M" : "L"}${sx.toFixed(2)},${sy.toFixed(2)}`;
    })
    .join(" ");

  const cx = xScale(model.elapsedSinceReview);
  const cy = yScale(model.currentR);
  const cxClamped = Math.min(Math.max(cx, padL), padL + innerW);

  const retentionY = yScale(FSRS_REQUEST_RETENTION);

  let scheduledLineX: number | null = null;
  if (
    model.scheduledSpanDays != null &&
    model.scheduledSpanDays <= model.xMax
  ) {
    scheduledLineX = xScale(model.scheduledSpanDays);
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <section
      className={cn(
        "rounded-xl border bg-muted/25 px-3 py-3 sm:px-4",
        className
      )}
      aria-label="FSRS forgetting curve"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
        <h3 className="text-sm font-semibold tracking-tight">
          Memory curve (FSRS)
        </h3>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          S {model.stability.toFixed(2)} d · now {pct(model.currentR)}
          {model.difficulty != null &&
            ` · D ${model.difficulty.toFixed(2)}`}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug mb-2">
        Estimated recall probability after days without practice — same decay
        model used for scheduling. Target retention line{" "}
        {pct(FSRS_REQUEST_RETENTION)}.
      </p>

      {!model.hasRecallHistory && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">
          No recall logged yet — curve assumes you&apos;re at day 0 since last
          practice (left edge).
        </p>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto text-foreground"
        role="img"
      >
        <title>
          FSRS retrievability from day 0 to {model.xMax} days since last review
        </title>

        {/* Grid */}
        <line
          x1={padL}
          y1={retentionY}
          x2={padL + innerW}
          y2={retentionY}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeDasharray="4 4"
        />
        <text
          x={padL + innerW}
          y={retentionY - 4}
          textAnchor="end"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.45}
        >
          target {pct(FSRS_REQUEST_RETENTION)}
        </text>

        {/* Axes */}
        <line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          stroke="currentColor"
          strokeOpacity={0.25}
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          stroke="currentColor"
          strokeOpacity={0.25}
        />

        <text
          x={padL}
          y={H - 6}
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.55}
        >
          0
        </text>
        <text
          x={padL + innerW}
          y={H - 6}
          textAnchor="end"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.55}
        >
          {model.xMax} d
        </text>
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.45}
        >
          days since last review →
        </text>

        {/* Curve */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Scheduled next due */}
        {scheduledLineX != null &&
          scheduledLineX >= padL &&
          scheduledLineX <= padL + innerW && (
            <>
              <line
                x1={scheduledLineX}
                y1={padT}
                x2={scheduledLineX}
                y2={padT + innerH}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
              />
              <text
                x={scheduledLineX + 4}
                y={padT + 11}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.5}
              >
                scheduled
              </text>
            </>
          )}

        {/* Today */}
        <line
          x1={cxClamped}
          y1={padT}
          x2={cxClamped}
          y2={padT + innerH}
          stroke="currentColor"
          strokeOpacity={0.22}
        />
        <circle
          cx={cxClamped}
          cy={cy}
          r={5}
          fill="hsl(var(--primary))"
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
      </svg>

      <p className="text-[10px] text-muted-foreground mt-1 font-mono opacity-80">
        R(t) = (1 + t/(9·S))⁻¹ · S = stability (days)
      </p>
    </section>
  );
}
