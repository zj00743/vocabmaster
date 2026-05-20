import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  type LearningStage,
  STAGE_ORDER,
  isoDay,
  isoMonth,
  isoWeekStart,
} from "@/lib/analytics";
import { frequencyBandForRank } from "@/lib/frequency-rank";

/** Last 365 days = enough for the GitHub-style heatmap plus weekly/monthly rollups. */
const DAILY_WINDOW_DAYS = 365;

interface ProgressRow {
  id: string;
  word_id: string;
  status: LearningStage;
  difficulty: number;
  stability: number;
  created_at: string;
  last_reviewed: string | null;
  next_review: string | null;
  word?: {
    word: string | null;
    rank: number | null;
    category: string | null;
  } | null;
}

interface ReviewRow {
  rating: number;
  reviewed_at: string;
}

const COCA_BANDS = [
  { key: "1-4k", label: "1–4k", min: 1, max: 4000 },
  { key: "4k-10k", label: "4k–10k", min: 4001, max: 10000 },
  { key: "10k-25k", label: "10k–25k", min: 10001, max: 25000 },
  { key: "25k+", label: "25k+", min: 25001, max: Number.POSITIVE_INFINITY },
] as const;

type DailyBucket = {
  date: string;
  added: number;
  reviewed: number;
  mastered: number;
};

function emptyDailyRange(days: number): Map<string, DailyBucket> {
  const map = new Map<string, DailyBucket>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = isoDay(d);
    map.set(key, { date: key, added: 0, reviewed: 0, mastered: 0 });
  }
  return map;
}

function emptyStageCounts(): Record<LearningStage, number> {
  return { new: 0, learning: 0, review: 0, mastered: 0 };
}

export async function GET() {
  try {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - (DAILY_WINDOW_DAYS - 1));
    windowStart.setHours(0, 0, 0, 0);
    const windowStartIso = windowStart.toISOString();

    /* Fetch the small set of rows we need. For a single-user app these are
       typically a few hundred / few thousand rows. */
    const [progressRes, reviewsRes] = await Promise.all([
      supabase
        .from("learning_progress")
        .select(
          "id, word_id, status, difficulty, stability, created_at, last_reviewed, next_review, word:words!inner(word, rank, category)"
        )
        .limit(50000),
      supabase
        .from("reviews")
        .select("rating, reviewed_at")
        .gte("reviewed_at", windowStartIso)
        .limit(200000),
    ]);

    if (progressRes.error) {
      return NextResponse.json(
        { error: progressRes.error.message },
        { status: 500 }
      );
    }
    if (reviewsRes.error) {
      return NextResponse.json(
        { error: reviewsRes.error.message },
        { status: 500 }
      );
    }

    /* Supabase types embedded relations as arrays; normalize to a single object. */
    const progress: ProgressRow[] = (progressRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const w = Array.isArray(r.word) ? (r.word[0] ?? null) : (r.word ?? null);
      return { ...r, word: w } as ProgressRow;
    });
    const reviews: ReviewRow[] = (reviewsRes.data ?? []) as ReviewRow[];

    /* === Daily series (added / reviewed / mastered) === */
    const daily = emptyDailyRange(DAILY_WINDOW_DAYS);

    for (const p of progress) {
      const created = new Date(p.created_at);
      const key = isoDay(created);
      const bucket = daily.get(key);
      if (bucket) bucket.added++;

      /* "Mastered on date X" proxy: a currently-mastered word's last_reviewed
         is the best signal we have without a status-change history. This may
         undercount churned-and-re-mastered words but is good enough. */
      if (p.status === "mastered" && p.last_reviewed) {
        const mDate = new Date(p.last_reviewed);
        const mKey = isoDay(mDate);
        const mBucket = daily.get(mKey);
        if (mBucket) mBucket.mastered++;
      }
    }

    for (const r of reviews) {
      const key = isoDay(new Date(r.reviewed_at));
      const bucket = daily.get(key);
      if (bucket) bucket.reviewed++;
    }

    /* === Totals snapshot === */
    const byStage = emptyStageCounts();
    for (const p of progress) {
      if (STAGE_ORDER.includes(p.status)) byStage[p.status]++;
    }

    /* === Cohort by month added: stack each month by current stage === */
    const cohortMonthMap = new Map<
      string,
      { month: string } & Record<LearningStage, number>
    >();
    const cohortWeekMap = new Map<
      string,
      { week: string } & Record<LearningStage, number>
    >();
    for (const p of progress) {
      const created = new Date(p.created_at);
      const month = isoMonth(created);
      const week = isoWeekStart(created);

      let monthEntry = cohortMonthMap.get(month);
      if (!monthEntry) {
        monthEntry = { month, ...emptyStageCounts() };
        cohortMonthMap.set(month, monthEntry);
      }
      let weekEntry = cohortWeekMap.get(week);
      if (!weekEntry) {
        weekEntry = { week, ...emptyStageCounts() };
        cohortWeekMap.set(week, weekEntry);
      }
      if (STAGE_ORDER.includes(p.status)) {
        monthEntry[p.status]++;
        weekEntry[p.status]++;
      }
    }
    const cohort_by_month = [...cohortMonthMap.values()].sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    const cohort_by_week = [...cohortWeekMap.values()].sort((a, b) =>
      a.week.localeCompare(b.week)
    );

    /* === CoCA-band × stage distribution === */
    const cocaBuckets = COCA_BANDS.map((b) => ({
      key: b.key,
      label: b.label,
      ...emptyStageCounts(),
    }));
    const noRankBucket = { key: "none", label: "No rank", ...emptyStageCounts() };
    for (const p of progress) {
      const rank = p.word?.rank ?? null;
      const band = frequencyBandForRank(rank);
      const target = band
        ? cocaBuckets.find((b) => b.key === band)
        : noRankBucket;
      if (target && STAGE_ORDER.includes(p.status)) {
        target[p.status]++;
      }
    }
    const coca_by_stage = [...cocaBuckets, noRankBucket];

    /* === Cumulative mastered (proxy = mastered words' last_reviewed) === */
    const masteredByDay = new Map<string, number>();
    for (const p of progress) {
      if (p.status !== "mastered" || !p.last_reviewed) continue;
      const key = isoDay(new Date(p.last_reviewed));
      masteredByDay.set(key, (masteredByDay.get(key) ?? 0) + 1);
    }
    const sortedMasteredDays = [...masteredByDay.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    let running = 0;
    const mastered_cumulative = sortedMasteredDays.map(([date, count]) => {
      running += count;
      return { date, count: running };
    });

    /* === Due forecast: next 30 days === */
    const dueMap = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(today.getDate() + 30);
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dueMap.set(isoDay(d), 0);
    }
    let overdue_count = 0;
    for (const p of progress) {
      if (!p.next_review) continue;
      const nr = new Date(p.next_review);
      if (nr < today) {
        overdue_count++;
        continue;
      }
      if (nr >= horizon) continue;
      const key = isoDay(nr);
      if (dueMap.has(key)) dueMap.set(key, (dueMap.get(key) ?? 0) + 1);
    }
    const due_forecast = [...dueMap.entries()].map(([date, count]) => ({
      date,
      count,
    }));

    /* === Rating mix (last 30 days) === */
    const ratingCutoff = new Date();
    ratingCutoff.setDate(ratingCutoff.getDate() - 30);
    const ratingDist = { again: 0, hard: 0, good: 0, easy: 0 };
    let ratingTotal = 0;
    for (const r of reviews) {
      if (new Date(r.reviewed_at) < ratingCutoff) continue;
      ratingTotal++;
      if (r.rating === 1) ratingDist.again++;
      else if (r.rating === 2) ratingDist.hard++;
      else if (r.rating === 3) ratingDist.good++;
      else if (r.rating === 4) ratingDist.easy++;
    }

    /* === Weekly retention: last 12 ISO weeks (Mon-start) === */
    const retentionMap = new Map<
      string,
      { reviews: number; goodOrEasy: number }
    >();
    const weekCutoff = new Date();
    weekCutoff.setDate(weekCutoff.getDate() - 7 * 12);
    for (const r of reviews) {
      const d = new Date(r.reviewed_at);
      if (d < weekCutoff) continue;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dow = monday.getDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      monday.setDate(monday.getDate() + offset);
      const key = isoDay(monday);
      let entry = retentionMap.get(key);
      if (!entry) {
        entry = { reviews: 0, goodOrEasy: 0 };
        retentionMap.set(key, entry);
      }
      entry.reviews++;
      if (r.rating === 3 || r.rating === 4) entry.goodOrEasy++;
    }
    const retention_weekly = [...retentionMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, v]) => ({
        week,
        reviews: v.reviews,
        retention:
          v.reviews > 0 ? Math.round((v.goodOrEasy / v.reviews) * 100) : 0,
      }));

    /* === Category × stage (top categories only, by total) === */
    const categoryMap = new Map<
      string,
      Record<LearningStage, number> & { total: number }
    >();
    for (const p of progress) {
      const cat = (p.word?.category ?? "").trim() || "uncategorized";
      let entry = categoryMap.get(cat);
      if (!entry) {
        entry = { ...emptyStageCounts(), total: 0 };
        categoryMap.set(cat, entry);
      }
      if (STAGE_ORDER.includes(p.status)) {
        entry[p.status]++;
        entry.total++;
      }
    }
    const category_by_stage = [...categoryMap.entries()]
      .map(([category, v]) => ({
        category,
        new: v.new,
        learning: v.learning,
        review: v.review,
        mastered: v.mastered,
        total: v.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    /* === Best study time: 7 days × 24 hours (Mon=0 … Sun=6) === */
    const studyMatrix: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0)
    );
    for (const r of reviews) {
      const d = new Date(r.reviewed_at);
      const jsDow = d.getDay(); // 0=Sun, 6=Sat
      const dow = jsDow === 0 ? 6 : jsDow - 1; // Mon=0 … Sun=6
      studyMatrix[dow][d.getHours()]++;
    }
    let studyMax = 0;
    for (const row of studyMatrix) {
      for (const v of row) if (v > studyMax) studyMax = v;
    }

    /* === Time-to-master histogram (current mastered words only) === */
    const timeToMasterBuckets = [
      { key: "lt1w", label: "< 1 week", min: 0, max: 6, count: 0 },
      { key: "w1_2", label: "1–2 weeks", min: 7, max: 13, count: 0 },
      { key: "w2_4", label: "2–4 weeks", min: 14, max: 29, count: 0 },
      { key: "m1_3", label: "1–3 months", min: 30, max: 89, count: 0 },
      { key: "m3_6", label: "3–6 months", min: 90, max: 179, count: 0 },
      { key: "m6p", label: "6 months+", min: 180, max: Infinity, count: 0 },
    ];
    const masteredDurations: number[] = [];
    for (const p of progress) {
      if (p.status !== "mastered" || !p.last_reviewed) continue;
      const days = Math.max(
        0,
        Math.floor(
          (new Date(p.last_reviewed).getTime() -
            new Date(p.created_at).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      );
      masteredDurations.push(days);
      const bucket = timeToMasterBuckets.find(
        (b) => days >= b.min && days <= b.max
      );
      if (bucket) bucket.count++;
    }
    masteredDurations.sort((a, b) => a - b);
    const medianTimeToMaster =
      masteredDurations.length === 0
        ? null
        : masteredDurations[Math.floor(masteredDurations.length / 2)];

    /* === Wobbly words: lowest FSRS stability among reviewed words. ===
       Skips brand-new words (never reviewed) since their FSRS state isn't
       meaningful yet. */
    const wobbly_words = progress
      .filter((p) => p.last_reviewed && p.status !== "mastered")
      .sort((a, b) => (a.stability ?? 0) - (b.stability ?? 0))
      .slice(0, 15)
      .map((p) => {
        const due = p.next_review ? new Date(p.next_review) : null;
        const nowMs = Date.now();
        const daysUntilDue = due
          ? Math.round((due.getTime() - nowMs) / (24 * 60 * 60 * 1000))
          : null;
        return {
          id: p.id,
          word_id: p.word_id,
          word: p.word?.word ?? "",
          status: p.status,
          stability: Number(p.stability?.toFixed?.(2) ?? p.stability ?? 0),
          difficulty: Number(p.difficulty?.toFixed?.(2) ?? p.difficulty ?? 0),
          next_review: p.next_review,
          days_until_due: daysUntilDue,
        };
      });

    return NextResponse.json({
      range_days: DAILY_WINDOW_DAYS,
      totals: {
        total_in_collection: progress.length,
        by_stage: byStage,
        mastered_count: byStage.mastered,
        reviews_window_total: reviews.length,
      },
      daily: [...daily.values()],
      cohort_by_month,
      cohort_by_week,
      coca_by_stage,
      category_by_stage,
      mastered_cumulative,
      due_forecast,
      overdue_count,
      rating_distribution: { ...ratingDist, total: ratingTotal },
      retention_weekly,
      study_time: { matrix: studyMatrix, max: studyMax },
      time_to_master: {
        buckets: timeToMasterBuckets.map(({ key, label, count }) => ({
          key,
          label,
          count,
        })),
        median_days: medianTimeToMaster,
        sample_size: masteredDurations.length,
      },
      wobbly_words,
    });
  } catch (err) {
    console.error("[analytics] aggregation failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
