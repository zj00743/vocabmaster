"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppShell } from "@/components/app-shell";
import { Flashcard, FlashcardRatingActions } from "@/components/flashcard";
import type { WordWithProgress, Rating, LearningProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";
import { needsAutoEnrich } from "@/lib/enrich-utils";
import {
  REVIEW_QUEUE_INVALIDATE_EVENT,
} from "@/lib/review-queue-sync";

export default function ReviewPage() {
  const [queue, setQueue] = useState<WordWithProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichDenyIds, setEnrichDenyIds] = useState(() => new Set<string>());

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/review");
      if (res.ok) {
        const data = await res.json();
        const cards = data.cards ?? data.words ?? (Array.isArray(data) ? data : []);
        const mapped: WordWithProgress[] = cards.map(
          (card: Record<string, unknown>) => {
            let merged: WordWithProgress;
            if (card.word && typeof card.word === "object") {
              const w = card.word as Record<string, unknown>;
              merged = {
                ...(w as unknown as WordWithProgress),
                progress: {
                  id: String(card.id ?? ""),
                  word_id: String(card.word_id ?? w.id ?? ""),
                  status: card.status as LearningProgress["status"],
                  difficulty: Number(card.difficulty ?? 0),
                  stability: Number(card.stability ?? 0),
                  next_review: String(card.next_review ?? ""),
                  last_reviewed: card.last_reviewed
                    ? String(card.last_reviewed)
                    : null,
                  review_count: Number(card.review_count ?? 0),
                  created_at: String(card.created_at ?? ""),
                },
              };
            } else {
              merged = card as unknown as WordWithProgress;
            }
            return normalizeWord(merged);
          }
        );
        setQueue(mapped);
        setFinished(mapped.length === 0);
      }
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadQueue().finally(() => setLoading(false));
  }, [loadQueue]);

  useEffect(() => {
    /* Same-tab removals from My Words / bulk delete invalidate this queue. */
    const onInvalidate = () => {
      setCurrentIndex(0);
      setShowAnswer(false);
      setFinished(false);
      setReviewedCount(0);
      setEnrichingId(null);
      setLoading(true);
      void loadQueue().finally(() => setLoading(false));
    };
    window.addEventListener(REVIEW_QUEUE_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(REVIEW_QUEUE_INVALIDATE_EVENT, onInvalidate);
  }, [loadQueue]);

  const handleFlip = useCallback(() => {
    setShowAnswer((show) => !show);
  }, []);

  const handleRate = useCallback(
    async (rating: Rating) => {
      const word = queue[currentIndex];
      if (!word) return;

      try {
        await fetch("/api/review/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word_id: word.id, rating, response_time: 0 }),
        });
      } catch {
        // will retry later
      }

      setReviewedCount((c) => c + 1);
      setShowAnswer(false);

      if (currentIndex + 1 >= queue.length) {
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [queue, currentIndex]
  );

  const total = queue.length;
  const progressValue = total > 0 ? ((currentIndex + (finished ? 1 : 0)) / total) * 100 : 0;
  const currentWord = queue[currentIndex];
  const curId = currentWord?.id;
  const shouldEnrichCard = useMemo(() => {
    if (!curId || !currentWord || enrichDenyIds.has(curId)) return false;
    return needsAutoEnrich(currentWord);
  }, [curId, currentWord, enrichDenyIds]);

  useEffect(() => {
    if (!curId || !shouldEnrichCard) return;
    let cancelled = false;
    setEnrichingId(curId);
    fetch(`/api/words/${curId}/enrich`, { method: "POST" })
      .then((r) => r.json())
      .then(
        (json: {
          word?: WordWithProgress;
          skipped?: boolean;
          reason?: string;
        }) => {
          if (cancelled) return;
          if (json.reason === "unavailable") {
            setEnrichDenyIds((prev) => new Set(prev).add(curId));
          }
          if (json?.word) {
            setQueue((q) =>
              q.map((x) =>
                x.id === curId
                  ? normalizeWord({ ...x, ...json.word } as WordWithProgress)
                  : x
              )
            );
          }
        }
      )
      .finally(() => {
        if (!cancelled) setEnrichingId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [curId, shouldEnrichCard]);

  return (
    <AppShell>
      <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden md:h-auto md:max-h-none">
        <header className="shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-8">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
            {total > 0 && !finished ? (
              <>
                <Progress
                  value={progressValue}
                  className="min-w-0 flex-1 gap-0 [&_[data-slot=progress-track]]:h-1.5"
                />
                <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                  {currentIndex + 1} / {total}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Review</span>
            )}
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 pb-[var(--review-card-pad-bottom)] md:px-8 md:py-4 md:pb-4 [--review-card-pad-bottom:var(--review-card-pad)] [--review-card-pad:calc(7.25rem+0.375rem+env(safe-area-inset-bottom,0px))]">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse text-muted-foreground">
              Loading review cards...
            </div>
          </div>
        )}

        {!loading && !finished && currentWord && (
          <div className="mb-1.5 flex min-h-0 flex-1 flex-col overflow-hidden">
            <Flashcard
              key={currentWord.id}
              word={currentWord}
              showAnswer={showAnswer}
              onFlip={handleFlip}
              onRate={handleRate}
              enriching={enrichingId === currentWord.id}
              fixedRatingBar
              showRatingBar={false}
            />
          </div>
        )}

        {!loading && finished && (
          <div className="text-center py-16 space-y-4">
            <CheckCircle2 className="size-16 mx-auto text-emerald-500" />
            <h2 className="text-xl font-bold">
              {reviewedCount > 0 ? "Session Complete!" : "All caught up!"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {reviewedCount > 0
                ? `You reviewed ${reviewedCount} card${reviewedCount !== 1 ? "s" : ""}. Great work!`
                : "No cards are due for review right now. Check back later."}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Link href="/">
                <Button variant="outline">Dashboard</Button>
              </Link>
              <Link href="/search">
                <Button>Add Words</Button>
              </Link>
            </div>
          </div>
        )}
      </div>

        {!loading && !finished && currentWord && (
          <FlashcardRatingActions onRate={handleRate} />
        )}
      </div>
    </AppShell>
  );
}
