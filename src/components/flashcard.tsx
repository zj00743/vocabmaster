"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Eye, EyeOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CocaOrCustomBadge } from "@/components/word-entry-badges";
import {
  entryBlankSlotChWidths,
  isPhraseEntry,
} from "@/lib/word-entry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WordImageUrlForm,
  type WordImageUrlFormHandle,
} from "@/components/word-image-url-form";
import { cn } from "@/lib/utils";
import type { WordWithProgress, Rating } from "@/lib/types";
import { RATING_LABELS } from "@/lib/types";
import type { WordCardSectionEditProps } from "@/lib/word-card-edit-types";
import { WordDetailBody } from "@/components/word-detail-body";
import {
  flashcardFrontGlossDisplay,
  normalizeWord,
} from "@/lib/word-utils";
import {
  buildVisualPrompt,
  hashSeed,
  pollinationsImageUrl,
} from "@/lib/card-image";
import {
  cancelSpeech,
  canUseSpeechSynthesis,
  playPronunciation,
} from "@/lib/pronunciation";

interface FlashcardProps {
  word: WordWithProgress;
  onRate: (rating: Rating) => void;
  showAnswer: boolean;
  onFlip: () => void;
  enriching?: boolean;
  /** Persist custom `image_url` from the card back into the review queue */
  onWordImageUpdate?: (wordId: string, imageUrl: string | null) => void;
  /** Fill available height above a docked rating bar (review page). */
  fixedRatingBar?: boolean;
  /** Set false when the parent renders a full-width rating bar (review page). */
  showRatingBar?: boolean;
  /** Word detail: staged section edits (pencil opens one block at a time). */
  sectionEdit?: WordCardSectionEditProps;
  /** Passed with `sectionEdit` so synonym/antonym/colocation textareas preserve unsaved keystrokes. */
  relationListDraftText?: {
    synonyms: string;
    antonyms: string;
    collocations: string;
  };
}

const ratingStyles: Record<Rating, string> = {
  1: "bg-red-500 hover:bg-red-600 text-white",
  2: "bg-orange-500 hover:bg-orange-600 text-white",
  3: "bg-emerald-500 hover:bg-emerald-600 text-white",
  4: "bg-blue-500 hover:bg-blue-600 text-white",
};

export function FlashcardRatingActions({
  onRate,
  className,
}: {
  onRate: (rating: Rating) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-8">
        <div className="flex justify-center gap-2 sm:gap-3">
          {([1, 2, 3, 4] as Rating[]).map((rating) => (
            <Button
              key={rating}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRate(rating);
              }}
              className={cn(
                "h-11 flex-1 min-w-0 max-w-none px-2 text-sm font-semibold font-sans sm:h-12 sm:text-base",
                ratingStyles[rating]
              )}
              size="default"
            >
              {RATING_LABELS[rating]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Flashcard({
  word: raw,
  onRate,
  showAnswer,
  onFlip,
  enriching,
  onWordImageUpdate,
  fixedRatingBar = false,
  showRatingBar = true,
  sectionEdit,
  relationListDraftText,
}: FlashcardProps) {
  const word = useMemo(() => normalizeWord(raw), [raw]);

  const [remoteHintText, setRemoteHintText] = useState<string | null>(null);

  const suppressDictionaryHints =
    !!sectionEdit && sectionEdit.editingSectionId === "back_definition";

  useEffect(() => {
    if (suppressDictionaryHints) return;
    let cancelled = false;
    const w = word.word.trim();
    if (!w) return;
    setRemoteHintText(null);
    fetch(`/api/dictionary-hint?word=${encodeURIComponent(w)}`)
      .then((r) => r.json())
      .then((j: { hint?: string | null; source?: string }) => {
        if (cancelled) return;
        if (j.hint && j.source && j.source !== "none") {
          setRemoteHintText(j.hint);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [word.word, suppressDictionaryHints]);

  const displayGloss = useMemo(
    () =>
      flashcardFrontGlossDisplay(word, {
        dictionaryHint: suppressDictionaryHints ? null : remoteHintText,
        rankShownOnCard: word.rank != null,
      }),
    [
      word,
      remoteHintText,
      suppressDictionaryHints,
    ]
  );

  const [wordVisible, setWordVisible] = useState(false);
  const isPhrase = isPhraseEntry(word.word);
  const blankSlotWidths = useMemo(
    () => entryBlankSlotChWidths(word.word),
    [word.word]
  );

  useEffect(() => {
    setWordVisible(false);
  }, [word.id]);

  const [speechOk, setSpeechOk] = useState(false);
  useEffect(() => {
    setSpeechOk(canUseSpeechSynthesis());
  }, []);

  useEffect(() => () => cancelSpeech(), []);

  const canListen =
    !!word.word.trim() &&
    (!!word.pronunciation_url?.trim() || speechOk);

  /** DB may not have image_url yet; still show a card image (matches enrich seed = word id). */
  const pollinationsFallback = useMemo(
    () =>
      pollinationsImageUrl(
        buildVisualPrompt(
          word.word,
          word.definition || word.translation_zh || "",
          word.image_prompt
        ),
        hashSeed(word.id)
      ),
    [
      word.id,
      word.word,
      word.definition,
      word.translation_zh,
      word.image_prompt,
    ]
  );

  const storedImage = word.image_url?.trim() ?? "";
  const primarySrc = storedImage || pollinationsFallback;
  /** 0 = normal src; 1 = retry Pollinations only if stored URL broke; 2 = show placeholder */
  const [imgTier, setImgTier] = useState(0);
  useEffect(() => {
    setImgTier(0);
  }, [word.id, storedImage, pollinationsFallback]);

  const activeSrc =
    imgTier === 0 ? primarySrc : imgTier === 1 ? pollinationsFallback : "";

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const imageFormRef = useRef<WordImageUrlFormHandle>(null);

  useEffect(() => {
    setImageDialogOpen(false);
  }, [word.id]);

  async function saveImageEdit() {
    const ok = await imageFormRef.current?.commit();
    if (ok) setImageDialogOpen(false);
  }

  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 48 && absY < 48) return;

    if (!showAnswer) {
      if (absX > absY || absY > 40) onFlip();
      return;
    }

    if (absX > absY) {
      if (dx < -48) onRate(1);
      else if (dx > 48) onRate(4);
    } else {
      if (dy < -48) onRate(3);
      else if (dy > 48) onRate(2);
    }
  }

  return (
    <>
      {onWordImageUpdate ? (
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="gap-4 sm:max-w-lg" showCloseButton>
            <DialogHeader>
              <DialogTitle>Edit card image</DialogTitle>
              <DialogDescription>
                Paste a screenshot, drop a file, or use a short image URL —
                nothing is saved until you tap Save.
              </DialogDescription>
            </DialogHeader>
            {imageDialogOpen ? (
              <WordImageUrlForm
                ref={imageFormRef}
                key={`${word.id}-img`}
                wordId={word.id}
                imageUrl={word.image_url}
                onSaved={(url) => onWordImageUpdate(word.id, url)}
                compact
                deferSave
              />
            ) : null}
            <DialogFooter className="border-t-0 bg-transparent px-2 pb-4 pt-2 sm:p-6 sm:border-t">
              <Button
                type="button"
                variant="outline"
                className="font-sans sm:min-w-24"
                onClick={() => setImageDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="font-sans bg-emerald-600 text-white hover:bg-emerald-700 sm:min-w-24"
                onClick={() => void saveImageEdit()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

    <div
      className={cn(
        "w-full touch-pan-y font-sans select-text",
        fixedRatingBar ? "flex min-h-0 flex-1 flex-col" : "mx-auto max-w-3xl",
        showRatingBar && fixedRatingBar && "gap-3 md:gap-4"
      )}
    >
      <div
        className={cn(
          "perspective-1000 w-full",
          fixedRatingBar &&
            "mx-auto flex min-h-0 max-w-3xl flex-1 flex-col"
        )}
      >
        <div
          className={cn(
            "flip-card-inner relative w-full rounded-2xl",
            showAnswer && "flipped",
            fixedRatingBar ? "min-h-0 flex-1 h-full max-h-full" : "h-full"
          )}
          style={fixedRatingBar ? undefined : { minHeight: "min(72vh, 640px)" }}
          onTouchStart={
            sectionEdit?.editingSectionId != null
              ? undefined
              : onTouchStart
          }
          onTouchEnd={
            sectionEdit?.editingSectionId != null
              ? undefined
              : onTouchEnd
          }
        >
          {/* Front */}
          <div className="backface-hidden absolute inset-0 rounded-2xl border bg-card shadow-sm flex flex-col overflow-hidden font-sans">
            <div className="relative shrink-0 aspect-[16/10] max-h-[46%] bg-muted/40 border-b flex items-center justify-center isolate group">
              {activeSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${word.id}-${imgTier}`}
                  src={activeSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="eager"
                  decoding="async"
                  onError={() =>
                    setImgTier((t) => {
                      if (t === 0) return storedImage ? 1 : 2;
                      return 2;
                    })
                  }
                  className="absolute inset-0 z-[1] h-full w-full object-cover [transform:translateZ(1px)]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
                  <BookOpen className="size-16 text-muted-foreground/35" />
                  {word.image_prompt ? (
                    <p className="text-sm text-center text-muted-foreground leading-snug line-clamp-3">
                      {word.image_prompt}
                    </p>
                  ) : (
                    <p className="text-sm text-center text-muted-foreground">
                      Image could not load. Check your network or try again.
                    </p>
                  )}
                </div>
              )}
              {onWordImageUpdate ? (
                <div className="absolute top-2 right-2 z-[2] opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-sans h-8 px-2.5 text-xs bg-background/95 shadow-sm backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageDialogOpen(true);
                    }}
                  >
                    Edit image
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center gap-4 min-h-0">
              <div className="flex flex-col items-center gap-3 w-full max-w-xl mx-auto">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 max-w-full">
                  {word.category?.trim() ? (
                    <Badge
                      variant="outline"
                      className="text-sm px-3 py-0.5 font-sans shrink-0"
                    >
                      {word.category}
                    </Badge>
                  ) : null}
                  <CocaOrCustomBadge
                    rank={word.rank}
                    className="text-sm px-3 py-0.5 font-sans"
                  />
                  {!isPhraseEntry(word.word) && word.part_of_speech?.trim() ? (
                    <Badge
                      variant="outline"
                      className="text-sm px-3 py-0.5 font-sans shrink-0 capitalize"
                    >
                      {word.part_of_speech}
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="font-sans shrink-0 size-10"
                    disabled={!canListen}
                    aria-label="Listen to pronunciation"
                    title={
                      !canListen
                        ? "Pronunciation not available"
                        : word.pronunciation_url?.trim()
                          ? "Play dictionary audio"
                          : "Play pronunciation"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      playPronunciation(word);
                    }}
                  >
                    <Volume2 className="size-4 shrink-0" aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-xl">
                  {wordVisible ? (
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words font-sans text-center">
                      {word.word}
                    </p>
                  ) : blankSlotWidths.length > 0 ? (
                    <div
                      className="flex flex-wrap items-center justify-center gap-2 shrink-0"
                      aria-hidden
                    >
                      {blankSlotWidths.map((widthCh, i) => (
                        <span
                          key={i}
                          className="inline-block h-9 sm:h-10 rounded-md border border-muted-foreground/25 bg-muted"
                          style={{
                            width: `${widthCh}ch`,
                            minWidth: "2.5rem",
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="font-sans shrink-0 size-10 sm:size-11 rounded-xl"
                    aria-label={
                      wordVisible
                        ? isPhrase
                          ? "Hide phrase"
                          : "Hide word"
                        : isPhrase
                          ? "Show phrase"
                          : "Show word"
                    }
                    aria-pressed={wordVisible}
                    title={
                      wordVisible
                        ? isPhrase
                          ? "Hide phrase"
                          : "Hide word"
                        : isPhrase
                          ? "Show phrase"
                          : "Show word"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setWordVisible((v) => !v);
                    }}
                  >
                    {wordVisible ? (
                      <EyeOff className="size-5" aria-hidden />
                    ) : (
                      <Eye className="size-5" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
              <div className="w-full max-w-xl flex flex-col items-stretch">
                <p className="text-lg sm:text-xl text-foreground/90 leading-snug max-w-xl line-clamp-6 font-sans text-center">
                  {displayGloss}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className={cn(
                    "font-sans min-w-[10rem] border-2 border-primary/25 bg-background",
                    "shadow-sm hover:bg-muted/60 hover:border-primary/40"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlip();
                  }}
                >
                  Flip card
                </Button>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 rounded-2xl border bg-card shadow-sm flex flex-col overflow-hidden font-sans">
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6 pb-4">
              <WordDetailBody
                word={word}
                showImageBlock={false}
                variant="flashcard"
                dictionaryHintFallback={
                  suppressDictionaryHints ? null : remoteHintText
                }
                statusBanner={
                  enriching
                    ? "Enriching card: dictionary, illustration link, optional AI (Chinese)…"
                    : null
                }
                sectionEdit={sectionEdit}
                relationListDraftText={relationListDraftText}
                onImageUpdate={
                  sectionEdit && onWordImageUpdate
                    ? (url) => onWordImageUpdate(word.id, url)
                    : undefined
                }
              />
            </div>
            <div className="shrink-0 flex flex-wrap items-center justify-center gap-3 px-6 pb-6 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(
                  "font-sans min-w-[10rem] border-2 border-primary/25 bg-background",
                  "shadow-sm hover:bg-muted/60 hover:border-primary/40"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onFlip();
                }}
              >
                Flip card
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showRatingBar &&
        (fixedRatingBar ? (
          <FlashcardRatingActions onRate={onRate} />
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap justify-center gap-2">
              {([1, 2, 3, 4] as Rating[]).map((rating) => (
                <Button
                  key={rating}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRate(rating);
                  }}
                  className={cn(
                    "min-w-[5.5rem] max-w-[7.5rem] flex-1 py-6 text-base font-medium font-sans font-semibold",
                    ratingStyles[rating]
                  )}
                  size="default"
                >
                  {RATING_LABELS[rating]}
                </Button>
              ))}
            </div>
          </div>
        ))}
    </div>
    </>
  );
}
