"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CaseSensitive,
  Eye,
  EyeOff,
  Pencil,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WordTypeBadge } from "@/components/word-entry-badges";
import {
  entryBlankSlotChWidths,
  isPhraseEntry,
  resolveShowImage,
} from "@/lib/word-entry";
import { cn } from "@/lib/utils";
import { wordImageEditPath } from "@/lib/word-section-meta";
import type { WordWithProgress, Rating } from "@/lib/types";
import { RATING_LABELS } from "@/lib/types";
import type {
  WordCardBrowseEditProps,
  WordCardSectionEditProps,
} from "@/lib/word-card-edit-types";
import { WordDetailBody } from "@/components/word-detail-body";
import {
  defaultDefinitionLang,
  flashcardFrontGlossDisplay,
  normalizeWord,
  shouldUseDictionaryDefinitionHint,
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
  /** Draft dialog: inline section edits. */
  sectionEdit?: WordCardSectionEditProps;
  /** My Words: pencil opens section edit page. */
  browseEdit?: WordCardBrowseEditProps;
  /** Passed with `sectionEdit` so synonym/antonym/colocation textareas preserve unsaved keystrokes. */
  relationListDraftText?: {
    synonyms: string;
    antonyms: string;
    collocations: string;
  };
  /** Pin Flip card above mobile bottom nav (word detail, dialogs). */
  stickyFlipBar?: boolean;
  /** Review: opens word editor (e.g. `/words/:id?tab=back`) when back is showing. */
  editWordHref?: string;
  /** My Words editor: flat scrollable front/back (no flip animation or card chrome). */
  layout?: "card" | "page";
  /** Which side to show when `layout` is `"page"`. */
  pageSide?: "front" | "back";
}

function FlipCardButton({
  onFlip,
  className,
}: {
  onFlip: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "font-sans h-8 min-w-0 px-3 text-sm font-medium",
        "border-primary/25 bg-background/95 shadow-sm backdrop-blur-sm",
        "hover:bg-muted/60 hover:border-primary/40",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onFlip();
      }}
    >
      Flip
    </Button>
  );
}

/** Mobile bottom nav (h-14) + review rating strip. */
export const reviewCardAreaPaddingBottom =
  "calc(7.25rem + env(safe-area-inset-bottom,0px))";

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
        "fixed inset-x-0 z-40 w-full shrink-0 border-t bg-background/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/80",
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]",
        "md:static md:z-auto md:border-t-0",
        className
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-2 md:px-8 md:pb-2">
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
  browseEdit,
  relationListDraftText,
  stickyFlipBar = false,
  editWordHref,
  layout = "card",
  pageSide = "front",
}: FlashcardProps) {
  const isPageLayout = layout === "page";
  const useReviewDock =
    !!editWordHref && fixedRatingBar && !isPageLayout;
  const showCornerFlip = !isPageLayout && !useReviewDock;
  const useDockedFlip = stickyFlipBar && !fixedRatingBar && !isPageLayout;
  const word = useMemo(() => normalizeWord(raw), [raw]);

  const [remoteHintText, setRemoteHintText] = useState<string | null>(null);

  const suppressDictionaryHints =
    !!sectionEdit && sectionEdit.editingSectionId === "back_definition";

  useEffect(() => {
    if (suppressDictionaryHints || !shouldUseDictionaryDefinitionHint(word)) {
      setRemoteHintText(null);
      return;
    }
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
  }, [word.word, word.hide_dictionary_definition, suppressDictionaryHints]);

  const [frontDefinitionLang, setFrontDefinitionLang] = useState<"en" | "zh">(
    () => defaultDefinitionLang(word)
  );

  const displayGloss = useMemo(
    () =>
      flashcardFrontGlossDisplay(word, {
        dictionaryHint: suppressDictionaryHints ? null : remoteHintText,
        rankShownOnCard: word.rank != null,
        lang: frontDefinitionLang,
      }),
    [word, remoteHintText, suppressDictionaryHints, frontDefinitionLang]
  );

  const [wordVisible, setWordVisible] = useState(false);
  /** Progressive disclosure: how many characters of the lemma are revealed. */
  const [revealCount, setRevealCount] = useState(0);
  const lemma = word.word;
  const lemmaFullyRevealed =
    wordVisible || revealCount >= lemma.length;
  const isPhrase = isPhraseEntry(word.word);
  /* Per-card image toggle (defaults off for expressions). */
  const showImage = resolveShowImage(
    word.word,
    word.entry_type,
    word.show_image
  );
  const blankSlotWidths = useMemo(
    () => entryBlankSlotChWidths(word.word),
    [word.word]
  );

  useEffect(() => {
    setWordVisible(false);
    setRevealCount(0);
    setFrontDefinitionLang(defaultDefinitionLang(word));
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

  const frontFaceBody = (
    <>
      {showImage && (
      <div
        className={cn(
          "relative flex w-full items-center justify-center px-4 py-3 bg-muted/40 isolate group",
          !isPageLayout && "shrink-0 border-b"
        )}
      >
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
            className="max-h-44 sm:max-h-48 w-auto max-w-full object-contain rounded-md"
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
          <Link
            href={wordImageEditPath(word.id)}
            aria-label="Edit image"
            className={cn(
              "absolute top-2 right-2 z-[2] inline-flex size-8 items-center justify-center rounded-md border border-input bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted/60 hover:text-foreground",
              !isPageLayout &&
                "opacity-0 duration-200 [@media(hover:hover)]:group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      )}

      <div
        className={cn(
          "flex flex-col items-center text-center gap-4",
          isPageLayout
            ? "px-4 py-6 sm:px-6 sm:py-8"
            : "flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 sm:p-8"
        )}
      >
        <div className="flex w-full max-w-xl min-w-0 mx-auto flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 max-w-full">
            {(word.tags ?? []).slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-sm px-3 py-0.5 font-sans shrink-0"
              >
                {tag.name}
              </Badge>
            ))}
            <WordTypeBadge
              word={word.word}
              rank={word.rank}
              entryType={word.entry_type}
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
          </div>
          <div className="flex w-full max-w-xl min-w-0 flex-col items-center gap-3">
            {lemmaFullyRevealed ? (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words font-sans text-center">
                {lemma}
              </p>
            ) : revealCount > 0 ? (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight break-words font-sans text-center">
                <span className="text-foreground">{lemma.slice(0, revealCount)}</span>
                <span className="text-muted-foreground/45">
                  {lemma
                    .slice(revealCount)
                    .replace(/[^\s]/g, "_")}
                </span>
              </p>
            ) : blankSlotWidths.length > 0 ? (
              <div
                className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2"
                aria-hidden
              >
                {blankSlotWidths.map((widthCh, i) => (
                  <span
                    key={i}
                    className="inline-block h-9 shrink-0 sm:h-10 rounded-md border border-muted-foreground/25 bg-muted"
                    style={{
                      width: `${widthCh}ch`,
                      minWidth: "2.5rem",
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="font-sans size-10 sm:size-11 rounded-xl"
                disabled={lemmaFullyRevealed}
                aria-label="Reveal next letter"
                title="Reveal next letter"
                onClick={(e) => {
                  e.stopPropagation();
                  setRevealCount((c) => Math.min(c + 1, lemma.length));
                }}
              >
                <CaseSensitive className="size-5" aria-hidden />
              </Button>
              {!isPhrase && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="font-sans size-10 sm:size-11 rounded-xl"
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
                  <Volume2 className="size-5 shrink-0" aria-hidden />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="font-sans size-10 sm:size-11 rounded-xl"
                aria-label={
                  wordVisible
                    ? isPhrase
                      ? "Hide expression"
                      : "Hide word"
                    : isPhrase
                      ? "Show expression"
                      : "Show word"
                }
                aria-pressed={wordVisible}
                title={
                  wordVisible
                    ? isPhrase
                      ? "Hide expression"
                      : "Hide word"
                    : isPhrase
                      ? "Show expression"
                      : "Show word"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (wordVisible) {
                    setWordVisible(false);
                    setRevealCount(0);
                  } else {
                    setWordVisible(true);
                  }
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
        </div>
        <div className="w-full max-w-xl flex flex-col items-stretch gap-2.5">
          <div className="flex justify-center">
            <div className="inline-flex rounded-md border border-border/60 bg-muted/25 p-0.5 font-sans shrink-0">
              <Button
                type="button"
                variant={
                  frontDefinitionLang === "en" ? "secondary" : "ghost"
                }
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setFrontDefinitionLang("en");
                }}
              >
                EN
              </Button>
              <Button
                type="button"
                variant={
                  frontDefinitionLang === "zh" ? "secondary" : "ghost"
                }
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setFrontDefinitionLang("zh");
                }}
              >
                中文
              </Button>
            </div>
          </div>
          {displayGloss ? (
            <p
              className={cn(
                "text-foreground/90 leading-snug max-w-xl font-sans text-center",
                "text-lg sm:text-xl"
              )}
            >
              {displayGloss}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isPageLayout) {
    return (
      <>
        <div className="w-full touch-pan-y font-sans select-text">
          {pageSide === "front" ? (
            <div className="flex flex-col">{frontFaceBody}</div>
          ) : (
            <div className="px-4 py-4 sm:px-6 sm:py-6">
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
                browseEdit={browseEdit}
                relationListDraftText={relationListDraftText}
                onImageUpdate={
                  (sectionEdit || browseEdit) && onWordImageUpdate
                    ? (url) => onWordImageUpdate(word.id, url)
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
    <div
      className={cn(
        "w-full touch-pan-y font-sans select-text",
        fixedRatingBar ? "flex min-h-0 flex-1 flex-col" : "mx-auto max-w-3xl",
        showRatingBar && fixedRatingBar && "gap-3 md:gap-4"
      )}
    >
      <div
        className={cn(
          "perspective-1000 relative w-full",
          fixedRatingBar &&
            "mx-auto flex min-h-0 max-w-3xl flex-1 flex-col"
        )}
      >
        {useReviewDock ? (
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
            <FlipCardButton onFlip={onFlip} />
            {showAnswer && editWordHref ? (
              <Link href={editWordHref}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "font-sans h-8 min-w-0 px-3 text-sm font-medium",
                    "border-primary/25 bg-background/95 shadow-sm backdrop-blur-sm",
                    "hover:bg-muted/60 hover:border-primary/40"
                  )}
                >
                  Edit
                </Button>
              </Link>
            ) : null}
          </div>
        ) : showCornerFlip ? (
          <FlipCardButton
            onFlip={onFlip}
            className="absolute top-3 right-3 z-20"
          />
        ) : null}
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
            {frontFaceBody}
          </div>

          {/* Back */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 rounded-2xl border bg-card shadow-sm flex flex-col overflow-hidden font-sans">
            <div
              className={cn(
                "flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6 pb-4",
                useReviewDock && showAnswer && "pt-20"
              )}
            >
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
                browseEdit={browseEdit}
                relationListDraftText={relationListDraftText}
                onImageUpdate={
                  (sectionEdit || browseEdit) && onWordImageUpdate
                    ? (url) => onWordImageUpdate(word.id, url)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      {useDockedFlip ? (
        <div
          className={cn(
            "fixed inset-x-0 z-40 border-t bg-background/95 backdrop-blur",
            "supports-[backdrop-filter]:bg-background/80",
            "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]",
            "px-4 py-3",
            "md:static md:z-auto md:mt-4 md:border-t-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
          )}
        >
          <div className="mx-auto flex max-w-3xl justify-center">
            <FlipCardButton onFlip={onFlip} />
          </div>
        </div>
      ) : null}

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
