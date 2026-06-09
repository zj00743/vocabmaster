import type { WordWithProgress } from "@/lib/types";

const STORAGE_KEY = "vocab:review-session";

export type StoredReviewSession = {
  /** Local calendar day the session belongs to (YYYY-MM-DD). */
  date: string;
  queue: WordWithProgress[];
  currentIndex: number;
  reviewedCount: number;
  finished: boolean;
};

export function getLocalDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSessionForToday(session: StoredReviewSession): boolean {
  return session.date === getLocalDateKey();
}

export function loadReviewSession(): StoredReviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReviewSession;
    if (
      !parsed ||
      typeof parsed.date !== "string" ||
      !Array.isArray(parsed.queue) ||
      typeof parsed.currentIndex !== "number" ||
      typeof parsed.reviewedCount !== "number" ||
      typeof parsed.finished !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveReviewSession(session: StoredReviewSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // quota / private mode — session still works in memory
  }
}

export function clearReviewSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function createReviewSession(
  queue: WordWithProgress[],
  overrides?: Partial<
    Pick<
      StoredReviewSession,
      "currentIndex" | "reviewedCount" | "finished"
    >
  >
): StoredReviewSession {
  return {
    date: getLocalDateKey(),
    queue,
    currentIndex: overrides?.currentIndex ?? 0,
    reviewedCount: overrides?.reviewedCount ?? 0,
    finished: overrides?.finished ?? queue.length === 0,
  };
}
