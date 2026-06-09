/** Filter My collections by when the word was added to the user's book. */
export type DateAddedFilter =
  | "all"
  | "today"
  | "yesterday"
  | "3d"
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "6m"
  | "year";

export const DATE_ADDED_FILTER_OPTIONS: {
  value: DateAddedFilter;
  label: string;
}[] = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "year", label: "This year" },
];

export function isValidDateAddedFilter(v: string): v is DateAddedFilter {
  return DATE_ADDED_FILTER_OPTIONS.some((o) => o.value === v);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ISO bounds for `learning_progress.created_at` (server-local calendar day). */
export function dateAddedFilterBounds(
  filter: DateAddedFilter,
  now = new Date()
): { gte?: string; lt?: string } | null {
  if (filter === "all") return null;

  if (filter === "today") {
    const start = startOfLocalDay(now);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return { gte: start.toISOString(), lt: end.toISOString() };
  }

  if (filter === "yesterday") {
    const todayStart = startOfLocalDay(now);
    const start = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() - 1
    );
    return { gte: start.toISOString(), lt: todayStart.toISOString() };
  }

  if (filter === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { gte: start.toISOString() };
  }

  if (filter === "6m") {
    const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    return { gte: start.toISOString() };
  }

  const dayMap: Partial<Record<DateAddedFilter, number>> = {
    "3d": 3,
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "90d": 90,
  };
  const days = dayMap[filter];
  if (days) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { gte: since.toISOString() };
  }

  return null;
}
