"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Flame,
  LineChart,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { HourHeatmap } from "@/components/charts/hour-heatmap";
import {
  type AnalyticsMetric,
  type Granularity,
  type LearningStage,
  METRIC_COLORS,
  METRIC_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_ORDER,
  formatBucketLabel,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface AnalyticsResponse {
  range_days: number;
  totals: {
    total_in_collection: number;
    by_stage: Record<LearningStage, number>;
    mastered_count: number;
    reviews_window_total: number;
  };
  daily: { date: string; added: number; reviewed: number; mastered: number }[];
  cohort_by_month: ({ month: string } & Record<LearningStage, number>)[];
  cohort_by_week: ({ week: string } & Record<LearningStage, number>)[];
  coca_by_stage: ({ key: string; label: string } & Record<LearningStage, number>)[];
  category_by_stage: ({ category: string; total: number } & Record<
    LearningStage,
    number
  >)[];
  mastered_cumulative: { date: string; count: number }[];
  due_forecast: { date: string; count: number }[];
  overdue_count: number;
  rating_distribution: {
    again: number;
    hard: number;
    good: number;
    easy: number;
    total: number;
  };
  retention_weekly: { week: string; reviews: number; retention: number }[];
  study_time: { matrix: number[][]; max: number };
  time_to_master: {
    buckets: { key: string; label: string; count: number }[];
    median_days: number | null;
    sample_size: number;
  };
  wobbly_words: {
    id: string;
    word_id: string;
    word: string;
    status: LearningStage;
    stability: number;
    difficulty: number;
    next_review: string | null;
    days_until_due: number | null;
  }[];
}

const STAGE_SEGMENTS = STAGE_ORDER.map((s) => ({
  key: s,
  label: STAGE_LABELS[s],
  color: STAGE_COLORS[s],
}));

const RATING_COLORS = {
  again: "#ef4444",
  hard: "#f59e0b",
  good: "#10b981",
  easy: "#3b82f6",
} as const;

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<AnalyticsMetric>("added");
  const [view, setView] = useState<"heatmap" | "series">("heatmap");
  const [variant, setVariant] = useState<"bar" | "line">("bar");
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [cohortGran, setCohortGran] = useState<"week" | "month">("month");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((j: AnalyticsResponse) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seriesData = useMemo(() => {
    if (!data) return [];
    return data.daily.map((d) => ({ date: d.date, value: d[metric] }));
  }, [data, metric]);

  const cohortRows = useMemo(() => {
    if (!data) return [];
    if (cohortGran === "week") {
      return data.cohort_by_week.map((c) => ({
        label: formatBucketLabel(c.week, "day"),
        values: {
          new: c.new,
          learning: c.learning,
          review: c.review,
          mastered: c.mastered,
        },
      }));
    }
    return data.cohort_by_month.map((c) => ({
      label: formatBucketLabel(c.month, "month"),
      values: {
        new: c.new,
        learning: c.learning,
        review: c.review,
        mastered: c.mastered,
      },
    }));
  }, [data, cohortGran]);

  const categoryRows = useMemo(() => {
    if (!data) return [];
    return data.category_by_stage.map((c) => ({
      label: c.category,
      values: {
        new: c.new,
        learning: c.learning,
        review: c.review,
        mastered: c.mastered,
      },
    }));
  }, [data]);

  const cocaRows = useMemo(() => {
    if (!data) return [];
    return data.coca_by_stage.map((c) => ({
      label: c.label,
      values: {
        new: c.new,
        learning: c.learning,
        review: c.review,
        mastered: c.mastered,
      },
    }));
  }, [data]);

  const ratingSlices = useMemo(() => {
    if (!data) return [];
    const r = data.rating_distribution;
    return [
      { key: "again", label: "Again", value: r.again, color: RATING_COLORS.again },
      { key: "hard", label: "Hard", value: r.hard, color: RATING_COLORS.hard },
      { key: "good", label: "Good", value: r.good, color: RATING_COLORS.good },
      { key: "easy", label: "Easy", value: r.easy, color: RATING_COLORS.easy },
    ];
  }, [data]);

  const stageSlices = useMemo(() => {
    if (!data) return [];
    return STAGE_ORDER.map((s) => ({
      key: s,
      label: STAGE_LABELS[s],
      value: data.totals.by_stage[s] ?? 0,
      color: STAGE_COLORS[s],
    }));
  }, [data]);

  const totalsRow = data?.totals;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto w-full space-y-6 pb-24">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track your learning rhythm, mastery, and where your vocabulary
            lives on the CoCA frequency spectrum.
          </p>
        </header>

        {loading && (
          <div className="text-center py-16 text-muted-foreground animate-pulse">
            Crunching numbers…
          </div>
        )}

        {!loading && !data && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Could not load analytics. Try refreshing.
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* === Summary KPIs === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                icon={<Sparkles className="size-4" />}
                label="In collection"
                value={data.totals.total_in_collection}
                tone="text-blue-500"
              />
              <Kpi
                icon={<TrendingUp className="size-4" />}
                label="Mastered"
                value={data.totals.mastered_count}
                tone="text-emerald-500"
              />
              <Kpi
                icon={<Activity className="size-4" />}
                label="Reviews (1y)"
                value={data.totals.reviews_window_total}
                tone="text-purple-500"
              />
              <Kpi
                icon={<Flame className="size-4" />}
                label="Overdue"
                value={data.overdue_count}
                tone={
                  data.overdue_count > 0 ? "text-orange-500" : "text-muted-foreground"
                }
              />
            </div>

            {/* === Activity (heatmap / time series) === */}
            <ChartCard
              title="Activity"
              description={
                metric === "mastered"
                  ? "When you crossed words into mastered (proxied by last review while in mastered state)."
                  : metric === "reviewed"
                    ? "Daily review volume."
                    : "Words added to your collection per day."
              }
              toolbar={
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    value={metric}
                    onChange={(v) => setMetric(v as AnalyticsMetric)}
                    options={(["added", "reviewed", "mastered"] as const).map(
                      (k) => ({ value: k, label: METRIC_LABELS[k] })
                    )}
                  />
                  <SegmentedControl
                    value={view}
                    onChange={(v) => setView(v as "heatmap" | "series")}
                    options={[
                      {
                        value: "heatmap",
                        label: (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3.5" />
                            Heatmap
                          </span>
                        ),
                      },
                      {
                        value: "series",
                        label: (
                          <span className="flex items-center gap-1">
                            <BarChart3 className="size-3.5" />
                            Series
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
              }
            >
              {view === "heatmap" ? (
                <ActivityHeatmap
                  data={seriesData}
                  unitLabel={
                    metric === "added"
                      ? "words added"
                      : metric === "reviewed"
                        ? "reviews"
                        : "mastered"
                  }
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SegmentedControl
                      value={granularity}
                      onChange={(v) => setGranularity(v as Granularity)}
                      options={[
                        { value: "day", label: "Day" },
                        { value: "week", label: "Week" },
                        { value: "month", label: "Month" },
                        { value: "year", label: "Year" },
                      ]}
                    />
                    <SegmentedControl
                      value={variant}
                      onChange={(v) => setVariant(v as "bar" | "line")}
                      options={[
                        {
                          value: "bar",
                          label: (
                            <span className="flex items-center gap-1">
                              <BarChart3 className="size-3.5" />
                              Bar
                            </span>
                          ),
                        },
                        {
                          value: "line",
                          label: (
                            <span className="flex items-center gap-1">
                              <LineChart className="size-3.5" />
                              Line
                            </span>
                          ),
                        },
                      ]}
                    />
                  </div>
                  <TimeSeriesChart
                    data={seriesData}
                    granularity={granularity}
                    variant={variant}
                    color={METRIC_COLORS[metric]}
                    unitLabel={
                      metric === "added"
                        ? "added"
                        : metric === "reviewed"
                          ? "reviews"
                          : "mastered"
                    }
                  />
                </div>
              )}
            </ChartCard>

            {/* === Current stage snapshot + mastery cumulative === */}
            <div className="grid md:grid-cols-2 gap-4">
              <ChartCard
                title="Where your words live"
                description="Distribution across learning stages today."
              >
                <DonutChart
                  slices={stageSlices}
                  centerLabel="words"
                  centerValue={totalsRow?.total_in_collection ?? 0}
                />
              </ChartCard>

              <ChartCard
                title="Mastery growth"
                description="Cumulative mastered words over the past year."
              >
                <CumulativeMasteredChart
                  data={data.mastered_cumulative}
                  current={data.totals.mastered_count}
                />
              </ChartCard>
            </div>

            {/* === Cohort by week / month added === */}
            <ChartCard
              title={`Cohort by ${cohortGran} added`}
              description="For each period you added new words, where are they now?"
              toolbar={
                <SegmentedControl
                  value={cohortGran}
                  onChange={(v) => setCohortGran(v as "week" | "month")}
                  options={[
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]}
                />
              }
            >
              {cohortRows.length === 0 ? (
                <EmptyHint>Add some words to see your cohorts.</EmptyHint>
              ) : (
                <div
                  className={cn(
                    cohortGran === "week" &&
                      cohortRows.length > 10 &&
                      "max-h-96 overflow-y-auto pr-1"
                  )}
                >
                  <StackedBarChart
                    rows={cohortRows}
                    segments={STAGE_SEGMENTS}
                    orientation="horizontal"
                    unitLabel="words"
                    showPercents
                  />
                </div>
              )}
            </ChartCard>

            {/* === CoCA rank x stage === */}
            <ChartCard
              title="CoCA rank × stage"
              description="Lower band = more common words. See which frequency bands you've conquered."
            >
              <StackedBarChart
                rows={cocaRows}
                segments={STAGE_SEGMENTS}
                orientation="horizontal"
                unitLabel="words"
                showPercents
              />
            </ChartCard>

            {/* === Due forecast === */}
            <ChartCard
              title="Due in the next 30 days"
              description={
                data.overdue_count > 0
                  ? `${data.overdue_count} cards are overdue — start a review session to catch up.`
                  : "Spot upcoming pile-ups before they happen."
              }
            >
              <TimeSeriesChart
                data={data.due_forecast.map((d) => ({
                  date: d.date,
                  value: d.count,
                }))}
                granularity="day"
                variant="bar"
                color="#fb923c"
                unitLabel="due"
              />
            </ChartCard>

            {/* === Review quality === */}
            <div className="grid md:grid-cols-2 gap-4">
              <ChartCard
                title="Recall quality (last 30 days)"
                description="Healthy decks land mostly in Good/Easy. Too much Again/Hard means the deck is outpacing your memory."
              >
                {data.rating_distribution.total === 0 ? (
                  <EmptyHint>Review some cards to populate this chart.</EmptyHint>
                ) : (
                  <DonutChart
                    slices={ratingSlices}
                    centerLabel="reviews"
                    centerValue={data.rating_distribution.total}
                  />
                )}
              </ChartCard>

              <ChartCard
                title="Weekly retention"
                description="% of reviews rated Good or Easy each week."
              >
                {data.retention_weekly.length === 0 ? (
                  <EmptyHint>Not enough reviews yet.</EmptyHint>
                ) : (
                  <TimeSeriesChart
                    data={data.retention_weekly.map((w) => ({
                      date: w.week,
                      value: w.retention,
                    }))}
                    granularity="week"
                    variant="line"
                    color="#8b5cf6"
                    unitLabel="% retention"
                  />
                )}
              </ChartCard>
            </div>

            {/* === Memory health section === */}
            <div className="pt-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Memory health
              </h2>
              <div className="space-y-4">
                {/* Best study time */}
                <ChartCard
                  title="When you study"
                  description="Reviews bucketed by day-of-week and hour-of-day. Your darker squares are your power hours."
                >
                  {data.study_time.max === 0 ? (
                    <EmptyHint>Review some cards to populate this heatmap.</EmptyHint>
                  ) : (
                    <HourHeatmap
                      matrix={data.study_time.matrix}
                      max={data.study_time.max}
                    />
                  )}
                </ChartCard>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Time-to-master */}
                  <ChartCard
                    title="Time to master"
                    description={
                      data.time_to_master.median_days != null
                        ? `Median: ${data.time_to_master.median_days} day${data.time_to_master.median_days === 1 ? "" : "s"} from add → mastered (over ${data.time_to_master.sample_size} word${data.time_to_master.sample_size === 1 ? "" : "s"}).`
                        : "Distribution of how long it took to reach mastered."
                    }
                  >
                    {data.time_to_master.sample_size === 0 ? (
                      <EmptyHint>
                        Master a few words to see this distribution.
                      </EmptyHint>
                    ) : (
                      <StackedBarChart
                        rows={data.time_to_master.buckets.map((b) => ({
                          label: b.label,
                          values: { count: b.count },
                        }))}
                        segments={[
                          { key: "count", label: "Words", color: STAGE_COLORS.mastered },
                        ]}
                        orientation="horizontal"
                        unitLabel="words"
                      />
                    )}
                  </ChartCard>

                  {/* Category strength */}
                  <ChartCard
                    title="Category strength"
                    description="Where you've built strongholds vs. weak spots."
                  >
                    {categoryRows.length === 0 ? (
                      <EmptyHint>No category-tagged words yet.</EmptyHint>
                    ) : (
                      <StackedBarChart
                        rows={categoryRows}
                        segments={STAGE_SEGMENTS}
                        orientation="horizontal"
                        unitLabel="words"
                        showPercents
                      />
                    )}
                  </ChartCard>
                </div>

                {/* Wobbly words */}
                <ChartCard
                  title="Wobbliest words"
                  description="Lowest FSRS stability — most likely to slip. Pre-empt them before your next session."
                >
                  {data.wobbly_words.length === 0 ? (
                    <EmptyHint>
                      Review a few words and the riskiest ones will surface here.
                    </EmptyHint>
                  ) : (
                    <WobblyWordsList words={data.wobbly_words} />
                  )}
                </ChartCard>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-2">
              <Target className="size-3" />
              Mastery dates are inferred from the last review of currently
              mastered words — the schema doesn't keep a full status history.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className={cn("shrink-0", tone)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  toolbar,
  children,
}: {
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {toolbar && <div className="shrink-0">{toolbar}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground text-center py-6">{children}</p>
  );
}

interface SegmentedOption<V extends string> {
  value: V;
  label: React.ReactNode;
}

function SegmentedControl<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: SegmentedOption<V>[];
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2.5 rounded text-xs font-medium",
            value === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function WobblyWordsList({
  words,
}: {
  words: AnalyticsResponse["wobbly_words"];
}) {
  /* Stability bar is scaled relative to this row group's max so the visual
     contrast is meaningful even when all words have small stability values. */
  const localMax = Math.max(1, ...words.map((w) => w.stability));
  return (
    <ul className="divide-y divide-border/60">
      {words.map((w) => {
        const widthPct = Math.min(100, (w.stability / localMax) * 100);
        const dueLabel = formatDueLabel(w.days_until_due);
        return (
          <li
            key={w.id}
            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{w.word}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0 rounded font-medium uppercase tracking-wide",
                    w.status === "learning" && "bg-orange-100 text-orange-700",
                    w.status === "review" && "bg-purple-100 text-purple-700",
                    w.status === "new" && "bg-blue-100 text-blue-700"
                  )}
                >
                  {w.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${widthPct}%`,
                      background: STAGE_COLORS.review,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  S {w.stability} · D {w.difficulty}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-16 text-right">
              {dueLabel}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatDueLabel(days: number | null): string {
  if (days == null) return "—";
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 7) return `in ${days}d`;
  if (days < 30) return `in ${Math.round(days / 7)}w`;
  return `in ${Math.round(days / 30)}mo`;
}

/** Tiny purpose-built area chart for cumulative mastery — re-uses TimeSeriesChart axes. */
function CumulativeMasteredChart({
  data,
  current,
}: {
  data: { date: string; count: number }[];
  current: number;
}) {
  if (data.length === 0) {
    return <EmptyHint>Master your first word to see this curve.</EmptyHint>;
  }
  /* Pad to today so the line extends to "now" at the current cumulative value. */
  const today = new Date().toISOString().slice(0, 10);
  const padded = data[data.length - 1].date === today
    ? data
    : [...data, { date: today, count: data[data.length - 1].count }];

  return (
    <div className="space-y-2">
      <div className="text-2xl font-bold tabular-nums">{current}</div>
      <TimeSeriesChart
        data={padded.map((d) => ({ date: d.date, value: d.count }))}
        granularity="month"
        variant="line"
        color={STAGE_COLORS.mastered}
        unitLabel="cumulative"
        height={160}
      />
    </div>
  );
}
