/** CoCA rank frequency bands (lower rank = more common); `custom` = not in CoCA bank. */
export type FrequencyBand =
  | "all"
  | "1-4k"
  | "4k-10k"
  | "10k-25k"
  | "25k+"
  | "custom";

export type WordSort = "frequency" | "alpha" | "added" | "last_reviewed";

export const FREQUENCY_BAND_OPTIONS: {
  value: FrequencyBand;
  label: string;
}[] = [
  { value: "all", label: "All frequencies" },
  { value: "1-4k", label: "1–4k (most common)" },
  { value: "4k-10k", label: "4k–10k" },
  { value: "10k-25k", label: "10k–25k" },
  { value: "25k+", label: "25k+ (least common)" },
  { value: "custom", label: "Custom (not in CoCA)" },
];

export const WORD_SORT_OPTIONS: { value: WordSort; label: string }[] = [
  { value: "frequency", label: "CoCA ranking" },
  { value: "alpha", label: "Alphabetic (A–Z)" },
  { value: "added", label: "Recently added" },
  { value: "last_reviewed", label: "Recently reviewed" },
];

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "review", label: "Review" },
  { value: "mastered", label: "Mastered" },
] as const;

export function frequencyBandForRank(
  rank: number | null | undefined
): FrequencyBand | null {
  if (rank == null || !Number.isFinite(rank)) return null;
  if (rank <= 4000) return "1-4k";
  if (rank <= 10000) return "4k-10k";
  if (rank <= 25000) return "10k-25k";
  return "25k+";
}

export function frequencyBandLabel(band: FrequencyBand | null): string | null {
  if (!band || band === "all") return null;
  const opt = FREQUENCY_BAND_OPTIONS.find((o) => o.value === band);
  return opt?.label ?? null;
}

const FREQUENCY_BADGE_SHORT: Record<Exclude<FrequencyBand, "all">, string> = {
  "1-4k": "1–4k",
  "4k-10k": "4k–10k",
  "10k-25k": "10k–25k",
  "25k+": "25k+",
  custom: "Custom",
};

export function frequencyBadgeLabel(rank: number | null | undefined): string | null {
  const band = frequencyBandForRank(rank);
  if (!band || band === "all") return null;
  return FREQUENCY_BADGE_SHORT[band];
}

/** Compact CoCA rank label for list cards (lower = more common). */
export function cocaRankLabel(rank: number | null | undefined): string | null {
  if (rank == null || !Number.isFinite(rank)) return null;
  return `#${rank}`;
}

export function cocaRankTooltip(rank: number | null | undefined): string | null {
  if (rank == null || !Number.isFinite(rank)) return null;
  return `CoCA ranking: ${rank}`;
}

export function isValidFrequencyBand(v: string): v is FrequencyBand {
  return FREQUENCY_BAND_OPTIONS.some((o) => o.value === v);
}

export function isValidWordSort(v: string): v is WordSort {
  return WORD_SORT_OPTIONS.some((o) => o.value === v);
}

export function formatCategoryLabel(category: string): string {
  if (!category) return category;
  return category.charAt(0).toUpperCase() + category.slice(1);
}
