/**
 * Date-bucket helpers + shared types for the Analytics page.
 *
 * All bucketing is done in the user's local timezone (server time is treated
 * as the user's time — this is a single-user app with no auth).
 */

export type AnalyticsMetric = "added" | "reviewed" | "mastered";
export type Granularity = "day" | "week" | "month" | "year";
export type LearningStage = "new" | "learning" | "review" | "mastered";

export const STAGE_ORDER: LearningStage[] = [
  "new",
  "learning",
  "review",
  "mastered",
];

export const STAGE_COLORS: Record<LearningStage, string> = {
  new: "#60a5fa", // blue-400
  learning: "#fb923c", // orange-400
  review: "#c084fc", // purple-400
  mastered: "#34d399", // emerald-400
};

export const STAGE_LABELS: Record<LearningStage, string> = {
  new: "New",
  learning: "Learning",
  review: "Review",
  mastered: "Mastered",
};

export const METRIC_LABELS: Record<AnalyticsMetric, string> = {
  added: "Words added",
  reviewed: "Reviews",
  mastered: "Words mastered",
};

export const METRIC_COLORS: Record<AnalyticsMetric, string> = {
  added: "#22c55e", // green-500
  reviewed: "#3b82f6", // blue-500
  mastered: "#10b981", // emerald-500
};

/** YYYY-MM-DD in the runtime's local time. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM. */
export function isoMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** ISO week start (Monday). Returns YYYY-MM-DD of the Monday. */
export function isoWeekStart(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0 = Sun
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  x.setDate(x.getDate() + offset);
  return isoDay(x);
}

/** YYYY. */
export function isoYear(d: Date): string {
  return String(d.getFullYear());
}

export function bucketKey(d: Date, g: Granularity): string {
  switch (g) {
    case "day":
      return isoDay(d);
    case "week":
      return isoWeekStart(d);
    case "month":
      return isoMonth(d);
    case "year":
      return isoYear(d);
  }
}

/** Inclusive generator of all bucket keys between start and end (chronological). */
export function bucketKeyRange(
  start: Date,
  end: Date,
  g: Granularity
): string[] {
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cur <= end) {
    keys.push(bucketKey(cur, g));
    if (g === "day") cur.setDate(cur.getDate() + 1);
    else if (g === "week") cur.setDate(cur.getDate() + 7);
    else if (g === "month") cur.setMonth(cur.getMonth() + 1);
    else cur.setFullYear(cur.getFullYear() + 1);
  }
  return [...new Set(keys)];
}

/** "Mar 15", "Mar 15, 2024" depending on whether the year matters. */
export function formatBucketLabel(key: string, g: Granularity): string {
  if (g === "year") return key;
  if (g === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

/** Default range for the time-series view at each granularity. */
export function rangeForGranularity(g: Granularity): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date(end);
  switch (g) {
    case "day":
      start.setDate(end.getDate() - 29);
      break;
    case "week":
      start.setDate(end.getDate() - 7 * 25);
      break;
    case "month":
      start.setMonth(end.getMonth() - 11);
      start.setDate(1);
      break;
    case "year":
      start.setFullYear(end.getFullYear() - 4);
      start.setMonth(0);
      start.setDate(1);
      break;
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** A single intensity ramp used by the heatmap. */
export function heatmapClass(value: number, max: number): string {
  if (!value || max <= 0) return "bg-muted/50";
  const ratio = value / max;
  if (ratio < 0.2) return "bg-emerald-200 dark:bg-emerald-900";
  if (ratio < 0.4) return "bg-emerald-300 dark:bg-emerald-800";
  if (ratio < 0.6) return "bg-emerald-400 dark:bg-emerald-700";
  if (ratio < 0.85) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-600 dark:bg-emerald-500";
}
