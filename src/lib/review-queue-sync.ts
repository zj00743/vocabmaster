import { clearReviewSession } from "@/lib/review-session-storage";

/**
 * When "My Words" rows are removed, `/review` keeps an in-memory queue.
 * Dispatched after a successful remove so the Review page refetches Supabase state.
 */
export const REVIEW_QUEUE_INVALIDATE_EVENT = "vocab:invalidate-review-queue";

export function invalidateClientReviewQueue() {
  if (typeof window !== "undefined") {
    clearReviewSession();
    window.dispatchEvent(new CustomEvent(REVIEW_QUEUE_INVALIDATE_EVENT));
  }
}
