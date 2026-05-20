import { LearningProgress, Rating } from './types';

const w = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01,
  1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
];

const REQUEST_RETENTION = 0.9;
const MAXIMUM_INTERVAL = 36500;

function clampDifficulty(d: number): number {
  return Math.min(Math.max(d, 1), 10);
}

function initStability(rating: Rating): number {
  return Math.max(w[rating - 1], 0.1);
}

function initDifficulty(rating: Rating): number {
  return clampDifficulty(w[4] - Math.exp(w[5] * (rating - 1)) + 1);
}

function nextInterval(stability: number): number {
  const interval = Math.round(
    stability / 9 * (1 / REQUEST_RETENTION - 1)
  );
  return Math.min(Math.max(interval, 1), MAXIMUM_INTERVAL);
}

function meanReversion(init: number, current: number): number {
  return w[7] * init + (1 - w[7]) * current;
}

function nextDifficulty(d: number, rating: Rating): number {
  const nextD = d - w[6] * (rating - 3);
  return clampDifficulty(meanReversion(w[4], nextD));
}

function nextRecallStability(
  d: number,
  s: number,
  r: number,
  rating: Rating
): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return (
    s *
    (1 +
      Math.exp(w[8]) *
        (11 - d) *
        Math.pow(s, -w[9]) *
        (Math.exp((1 - r) * w[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function nextForgetStability(
  d: number,
  s: number,
  r: number
): number {
  return (
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14])
  );
}

/** Target retention used when deriving intervals from stability (matches scheduler). */
export const FSRS_REQUEST_RETENTION = REQUEST_RETENTION;

/**
 * FSRS forgetting curve: estimated probability of recall vs days elapsed since
 * the **last review**, given current stability `S` (in days).
 *
 * Formula: R(t) = (1 + t / (9·S))⁻¹ — same as used inside {@link scheduleFSRS}.
 */
export function forgettingCurveRetrievability(
  elapsedDaysSinceReview: number,
  stabilityDays: number
): number {
  const S = Math.max(stabilityDays, 0.1);
  const t = Math.max(elapsedDaysSinceReview, 0);
  return Math.pow(1 + t / (9 * S), -1);
}

function forgettingCurve(elapsedDays: number, stability: number): number {
  return forgettingCurveRetrievability(elapsedDays, stability);
}

function getElapsedDays(lastReviewed: string | null): number {
  if (!lastReviewed) return 0;
  const now = new Date();
  const last = new Date(lastReviewed);
  return Math.max(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
    0
  );
}

function getStatus(
  reviewCount: number,
  rating: Rating
): LearningProgress['status'] {
  if (rating === 1) return 'learning';
  if (reviewCount <= 1) return 'learning';
  if (reviewCount <= 3) return 'review';
  return 'mastered';
}

export function scheduleFSRS(
  progress: LearningProgress | null,
  rating: Rating
): Partial<LearningProgress> {
  const now = new Date().toISOString();

  if (!progress || progress.review_count === 0) {
    const s = initStability(rating);
    const d = initDifficulty(rating);
    const interval = rating === 1 ? 1 : nextInterval(s);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      status: rating === 1 ? 'learning' : 'learning',
      difficulty: d,
      stability: s,
      next_review: nextReview.toISOString(),
      last_reviewed: now,
      review_count: 1,
    };
  }

  const elapsedDays = getElapsedDays(progress.last_reviewed);
  const retrievability = forgettingCurve(elapsedDays, progress.stability);
  const newD = nextDifficulty(progress.difficulty, rating);
  const reviewCount = progress.review_count + 1;

  let newS: number;
  if (rating === 1) {
    newS = nextForgetStability(
      progress.difficulty,
      progress.stability,
      retrievability
    );
  } else {
    newS = nextRecallStability(
      progress.difficulty,
      progress.stability,
      retrievability,
      rating
    );
  }

  newS = Math.max(newS, 0.1);
  const interval = rating === 1 ? 1 : nextInterval(newS);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    status: getStatus(reviewCount, rating),
    difficulty: newD,
    stability: newS,
    next_review: nextReview.toISOString(),
    last_reviewed: now,
    review_count: reviewCount,
  };
}
