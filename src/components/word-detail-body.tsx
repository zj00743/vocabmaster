"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Volume2, ExternalLink, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CocaOrCustomBadge } from "@/components/word-entry-badges";
import { isPhraseEntry } from "@/lib/word-entry";
import type { WordWithProgress } from "@/lib/types";
import { normalizeWord, splitStoredDefinitionLines, definitionToEditLines, editLinesToDefinition } from "@/lib/word-utils";
import { cn } from "@/lib/utils";
import { WordImageUrlForm } from "@/components/word-image-url-form";
import { playPronunciation } from "@/lib/pronunciation";
import { externalDictionaryResources } from "@/lib/dictionary-links";
import type {
  WordCardBrowseEditProps,
  WordCardSectionEditProps,
  WordCardEditSectionId,
} from "@/lib/word-card-edit-types";
import { SectionEditLink } from "@/components/section-edit-link";
import {
  SectionEditActions,
  sectionEditBlocked,
} from "@/lib/word-card-section-edit";

export type {
  FlashcardInlineEditField,
  FlashcardInlineEditHandler,
} from "@/lib/word-card-edit-types";

function definitionBullets(text: string): string[] {
  return splitStoredDefinitionLines(text);
}

function uniqueDefinitionBullets(text: string): string[] {
  const seen = new Set<string>();
  return definitionBullets(text).filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function FlashcardSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const fcListClass =
  "list-disc space-y-2.5 pl-5 text-[15px] leading-[1.55] marker:text-muted-foreground/60";

const inlineTextareaCn = cn(
  "flex min-h-[4.5rem] w-full rounded-lg border border-input bg-background px-3 py-2.5",
  "text-sm leading-relaxed font-sans resize-y outline-none placeholder:text-muted-foreground",
  "focus-visible:ring-ring/35 focus-visible:ring-[3px] focus-visible:border-ring"
);

function TruncatedRelationList({
  items,
  initialLimit,
  listClassName,
  renderItem,
}: {
  items: string[];
  initialLimit: number;
  listClassName: string;
  renderItem: (item: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > initialLimit;
  const visible = expanded ? items : items.slice(0, initialLimit);
  const hiddenCount = items.length - initialLimit;

  useEffect(() => {
    setExpanded(false);
  }, [items]);

  return (
    <>
      <ul className={listClassName}>
        {visible.map((item, i) => (
          <li key={i}>{renderItem(item)}</li>
        ))}
      </ul>
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 px-2 text-xs text-muted-foreground font-sans hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show more (${hiddenCount})`}
        </Button>
      ) : null}
    </>
  );
}

function RelationListSection({
  title,
  items,
  fc,
  initialLimit,
}: {
  title: string;
  items: string[];
  fc: boolean;
  initialLimit: number;
}) {
  if (items.length === 0) return null;
  if (fc) {
    return (
      <FlashcardSection title={title}>
        <TruncatedRelationList
          items={items}
          initialLimit={initialLimit}
          listClassName={cn(fcListClass, "text-foreground/85")}
          renderItem={(item) => item}
        />
      </FlashcardSection>
    );
  }
  return (
    <div className="space-y-1">
      <p className="font-medium text-muted-foreground uppercase tracking-wider font-sans text-xs">
        {title}
      </p>
      <TruncatedRelationList
        items={items}
        initialLimit={initialLimit}
        listClassName="space-y-0.5 font-sans text-sm"
        renderItem={(item) => (
          <span className="text-muted-foreground">• {item}</span>
        )}
      />
    </div>
  );
}

type FlashcardEditableListSectionId = Extract<
  WordCardEditSectionId,
  "back_synonyms" | "back_antonyms" | "back_collocations"
>;

function FlashcardEditableListSection({
  title,
  sectionId,
  field,
  items,
  sect,
  browseEdit,
  placeholder,
  emptyBrowse,
  draftText,
  initialLimit,
}: {
  title: string;
  sectionId: FlashcardEditableListSectionId;
  field: "synonyms" | "antonyms" | "collocations";
  items: string[];
  sect?: WordCardSectionEditProps;
  browseEdit?: WordCardBrowseEditProps;
  placeholder: string;
  emptyBrowse: string;
  draftText?: string;
  initialLimit: number;
}) {
  if (!sect && !browseEdit) {
    if (items.length === 0) return null;
    return (
      <FlashcardSection title={title}>
        <TruncatedRelationList
          items={items}
          initialLimit={initialLimit}
          listClassName={cn(fcListClass, "text-foreground/85")}
          renderItem={(item) => item}
        />
      </FlashcardSection>
    );
  }

  const editAction = browseEdit ? (
    <SectionEditLink wordId={browseEdit.wordId} sectionId={sectionId} />
  ) : sect ? (
    <SectionEditActions
      isEditing={sect.editingSectionId === sectionId}
      disabledStart={sectionEditBlocked(sect.editingSectionId, sectionId)}
      saving={sect.sectionSaving}
      onEdit={() => sect.onStartSectionEdit(sectionId)}
      onCancel={() => sect.onCancelSectionEdit()}
      onSave={() => sect.onSaveTextSection(sectionId)}
    />
  ) : null;

  const isInlineEditing = !!sect && sect.editingSectionId === sectionId;

  return (
    <FlashcardSection title={title} action={editAction}>
      {isInlineEditing ? (
        <label className="flex flex-col gap-1.5 text-xs font-sans text-muted-foreground">
          One phrase per line
          <textarea
            spellCheck={true}
            value={draftText ?? items.join("\n")}
            onChange={(e) =>
              sect.onSectionFieldChange(field, e.target.value)
            }
            placeholder={placeholder}
            rows={Math.min(
              10,
              Math.max(5, Math.max(items.length + 3, 5))
            )}
            className={inlineTextareaCn}
          />
        </label>
      ) : items.length > 0 ? (
        <TruncatedRelationList
          items={items}
          initialLimit={initialLimit}
          listClassName={cn(fcListClass, "text-foreground/85")}
          renderItem={(item) => item}
        />
      ) : (
        <p className="text-[15px] leading-snug text-muted-foreground font-sans italic">
          {emptyBrowse}
        </p>
      )}
    </FlashcardSection>
  );
}

interface WordDetailBodyProps {
  word: WordWithProgress;
  /** When true, show image block (e.g. sheet); flashcard front has its own image */
  showImageBlock?: boolean;
  /** Shown above content when definitions are being fetched */
  statusBanner?: string | null;
  /** Larger type + sans IPA on flashcard back */
  variant?: "default" | "flashcard";
  /**
   * Same live Merriam-Webster hint as the card front (`/api/dictionary-hint`).
   * Used on the flashcard back when `word.definition` is still empty so EN matches the front.
   */
  dictionaryHintFallback?: string | null;
  /** After saving a custom image URL from the form below the image block */
  onImageUpdate?: (imageUrl: string | null) => void;
  /** Newline drafts for synonyms / antonyms / collocations (card editor only). */
  relationListDraftText?: {
    synonyms: string;
    antonyms: string;
    collocations: string;
  };
  /** Draft dialog: inline staged edits */
  sectionEdit?: WordCardSectionEditProps;
  /** My Words: pencil navigates to section edit page */
  browseEdit?: WordCardBrowseEditProps;
}

export function WordDetailBody({
  word: raw,
  showImageBlock = true,
  statusBanner,
  variant = "default",
  dictionaryHintFallback,
  onImageUpdate,
  sectionEdit,
  browseEdit,
  relationListDraftText,
}: WordDetailBodyProps) {
  const word = normalizeWord(raw);
  const isPhrase = isPhraseEntry(word.word);
  const youglish = `https://youglish.com/pronounce/${encodeURIComponent(word.word)}/english`;
  const fc = variant === "flashcard";
  const sect = fc && sectionEdit ? sectionEdit : undefined;
  const browse = fc && browseEdit ? browseEdit : undefined;
  const [definitionLang, setDefinitionLang] = useState<"en" | "zh">("en");

  useEffect(() => {
    setDefinitionLang("en");
  }, [word.id]);

  return (
    <div
      className={cn(
        "text-left font-sans",
        fc ? "space-y-0 text-base" : "space-y-4"
      )}
    >
      {statusBanner && (
        <p
          className={cn(
            "text-center rounded-md bg-muted px-2 py-1.5 text-muted-foreground animate-pulse",
            fc ? "text-sm" : "text-xs"
          )}
        >
          {statusBanner}
        </p>
      )}
      {showImageBlock && (
        <>
          <div
            className={cn(
              "rounded-xl border bg-muted/30 overflow-hidden aspect-[16/9] flex items-center justify-center",
              fc ? "max-h-56" : "max-h-44"
            )}
          >
            {word.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={word.image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center px-4 py-6 space-y-1">
                <BookOpen
                  className={cn(
                    "mx-auto text-muted-foreground/40",
                    fc ? "size-12" : "size-10"
                  )}
                />
                {word.image_prompt ? (
                  <p
                    className={cn(
                      "text-muted-foreground leading-snug line-clamp-3",
                      fc ? "text-sm" : "text-xs"
                    )}
                  >
                    {word.image_prompt}
                  </p>
                ) : (
                  <p className={cn("text-muted-foreground", fc ? "text-sm" : "text-xs")}>
                    No image yet
                  </p>
                )}
              </div>
            )}
          </div>
          {onImageUpdate ? (
            <WordImageUrlForm
              wordId={word.id}
              imageUrl={word.image_url}
              onSaved={onImageUpdate}
              compact={fc}
            />
          ) : null}
        </>
      )}

      {fc ? (
        <>
          <div className="space-y-3.5 pb-5">
          {sect && sect.editingSectionId === "back_header" ? (
            <>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 sm:text-left">
                  {word.is_custom ? (
                    <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-xs text-muted-foreground font-sans">
                      Word
                      <Input
                        value={word.word}
                        onChange={(e) =>
                          sect.onSectionFieldChange("lemma", e.target.value)
                        }
                        className="text-3xl sm:text-[2rem] font-bold tracking-tight h-auto py-2 font-sans"
                      />
                    </label>
                  ) : (
                    <h2 className="text-3xl sm:text-[2rem] font-bold tracking-tight font-sans break-words leading-tight">
                      {word.word}
                    </h2>
                  )}
                  {!isPhrase ? (
                    <label className="flex w-[7.5rem] flex-col gap-1.5 text-xs text-muted-foreground font-sans shrink-0">
                      POS
                      <Input
                        value={word.part_of_speech ?? ""}
                        onChange={(e) =>
                          sect.onSectionFieldChange(
                            "part_of_speech",
                            e.target.value
                          )
                        }
                        className="capitalize font-sans text-sm h-10"
                        placeholder="noun"
                      />
                    </label>
                  ) : null}
                </div>
                <SectionEditActions
                  isEditing={sect.editingSectionId === "back_header"}
                  disabledStart={sectionEditBlocked(
                    sect.editingSectionId,
                    "back_header"
                  )}
                  saving={sect.sectionSaving}
                  onEdit={() => sect.onStartSectionEdit("back_header")}
                  onCancel={() => sect.onCancelSectionEdit()}
                  onSave={() => sect.onSaveTextSection("back_header")}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-start">
                <label className="flex min-w-[8rem] max-w-[16rem] flex-1 flex-col gap-1.5 text-xs text-muted-foreground font-sans">
                  IPA
                  <Input
                    value={word.ipa ?? ""}
                    onChange={(e) =>
                      sect.onSectionFieldChange("ipa", e.target.value)
                    }
                    className="font-mono text-sm"
                    placeholder="/…/"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-10 w-10 p-0 rounded-full shrink-0 mt-6 sm:mt-6"
                  onClick={() => playPronunciation(word)}
                  aria-label="Pronounce"
                >
                  <Volume2 className="size-5" />
                </Button>
                <a
                  href={youglish}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-transparent hover:bg-muted/60 transition-colors font-sans h-10 px-3 text-sm shrink-0 mt-6 sm:mt-6"
                >
                  YouGlish <ExternalLink className="size-3.5" />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <label className="flex min-w-[7rem] max-w-[12rem] flex-col gap-1.5 text-xs text-muted-foreground font-sans">
                  Category
                  <Input
                    value={word.category ?? ""}
                    onChange={(e) =>
                      sect.onSectionFieldChange("category", e.target.value)
                    }
                    className="font-sans text-sm"
                    placeholder="e.g. academic"
                  />
                </label>
                <CocaOrCustomBadge
                  rank={word.rank}
                  className="text-sm px-3 py-0.5 font-sans self-center mt-6"
                />
                {word.word_family?.trim() ? (
                  <Badge
                    variant="outline"
                    className="text-sm px-3 py-0.5 font-sans shrink-0 self-center mt-6"
                  >
                    Family: {word.word_family}
                  </Badge>
                ) : null}
              </div>
            </>
          ) : (
            <>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:text-left">
              <h2 className="text-3xl sm:text-[2rem] font-bold tracking-tight font-sans break-words leading-tight">
                {word.word}
              </h2>
              {!isPhrase && word.part_of_speech?.trim() ? (
                <Badge
                  variant="outline"
                  className="text-sm px-3 py-0.5 font-sans shrink-0 capitalize"
                >
                  {word.part_of_speech}
                </Badge>
              ) : null}
            </div>
            {browse ? (
              <SectionEditLink
                wordId={browse.wordId}
                sectionId="back_header"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-start">
            <p className="text-base tracking-wide text-muted-foreground font-sans min-h-[1.25rem]">
              {word.ipa || "—"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="h-10 w-10 p-0 rounded-full shrink-0"
              onClick={() => playPronunciation(word)}
              aria-label="Pronounce"
            >
              <Volume2 className="size-5" />
            </Button>
            <a
              href={youglish}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-transparent hover:bg-muted/60 transition-colors font-sans h-10 px-3 text-sm shrink-0"
            >
              YouGlish <ExternalLink className="size-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
              <CocaOrCustomBadge
                rank={word.rank}
                className="text-sm px-3 py-0.5 font-sans"
              />
              {word.category?.trim() && (
                <Badge
                  variant="outline"
                  className="text-sm px-3 py-0.5 font-sans shrink-0"
                >
                  {word.category}
                </Badge>
              )}
              {word.word_family?.trim() && (
                <Badge
                  variant="outline"
                  className="text-sm px-3 py-0.5 font-sans shrink-0"
                >
                  Family: {word.word_family}
                </Badge>
              )}
            </div>
            </>
          )}
          </div>

          <div className="border-t border-border/60 divide-y divide-border/60">
            <FlashcardSection
              title="Definition"
              action={
                sect || browse ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {(!sect || sect.editingSectionId !== "back_definition") && (
                      <div className="inline-flex rounded-md border border-border/60 bg-muted/25 p-0.5 font-sans shrink-0">
                        <Button
                          type="button"
                          variant={
                            definitionLang === "en" ? "secondary" : "ghost"
                          }
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => setDefinitionLang("en")}
                        >
                          EN
                        </Button>
                        <Button
                          type="button"
                          variant={
                            definitionLang === "zh" ? "secondary" : "ghost"
                          }
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => setDefinitionLang("zh")}
                        >
                          中文
                        </Button>
                      </div>
                    )}
                    {browse ? (
                      <SectionEditLink
                        wordId={browse.wordId}
                        definitionLang={definitionLang}
                      />
                    ) : (
                      <SectionEditActions
                        isEditing={sect!.editingSectionId === "back_definition"}
                        disabledStart={sectionEditBlocked(
                          sect!.editingSectionId,
                          "back_definition"
                        )}
                        saving={sect!.sectionSaving}
                        onEdit={() =>
                          sect!.onStartSectionEdit("back_definition")
                        }
                        onCancel={() => sect!.onCancelSectionEdit()}
                        onSave={() =>
                          sect!.onSaveTextSection("back_definition")
                        }
                      />
                    )}
                  </div>
                ) : (
                <div className="inline-flex rounded-md border border-border/60 bg-muted/25 p-0.5 font-sans shrink-0">
                  <Button
                    type="button"
                    variant={definitionLang === "en" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setDefinitionLang("en")}
                  >
                    EN
                  </Button>
                  <Button
                    type="button"
                    variant={definitionLang === "zh" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setDefinitionLang("zh")}
                  >
                    中文
                  </Button>
                </div>
                )
              }
            >
              {sect && sect.editingSectionId === "back_definition" ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-1.5 text-xs font-sans text-muted-foreground">
                    English · first line appears on card front · one sense per line
                    <textarea
                      spellCheck={true}
                      value={definitionToEditLines(word.definition ?? "")}
                      onChange={(e) =>
                        sect.onSectionFieldChange(
                          "definition",
                          editLinesToDefinition(e.target.value)
                        )
                      }
                      placeholder="One gloss per line"
                      rows={Math.min(
                        16,
                        Math.max(
                          6,
                          definitionToEditLines(
                            word.definition ?? ""
                          ).split("\n").length + 2
                        )
                      )}
                      className={cn(inlineTextareaCn, "min-h-[10rem]")}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-sans text-muted-foreground">
                    中文 · one line per bullet if using multiple glosses
                    <textarea
                      value={definitionToEditLines(
                        word.translation_zh ?? ""
                      )}
                      onChange={(e) =>
                        sect.onSectionFieldChange(
                          "translation_zh",
                          editLinesToDefinition(e.target.value)
                        )
                      }
                      rows={Math.min(
                        10,
                        Math.max(
                          4,
                          definitionToEditLines(
                            word.translation_zh ?? ""
                          ).split("\n").length + 2
                        )
                      )}
                      className={inlineTextareaCn}
                    />
                  </label>
                </div>
              ) : definitionLang === "en" ? (
                (() => {
                  const fromDb = uniqueDefinitionBullets(
                    word.definition ?? ""
                  );
                  const hint = dictionaryHintFallback?.trim() ?? "";
                  const bullets =
                    fromDb.length > 0
                      ? fromDb
                      : hint
                        ? uniqueDefinitionBullets(hint)
                        : [];
                  if (bullets.length === 0) {
                    return (
                      <p className="text-[15px] leading-[1.55] text-muted-foreground font-sans italic">
                        No English gloss yet. Review auto-enriches from
                        Merriam-Webster when possible.
                      </p>
                    );
                  }
                  return (
                    <ul
                      className={cn(
                        fcListClass,
                        "text-foreground/85 min-h-[1.25rem]"
                      )}
                    >
                      {bullets.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  );
                })()
              ) : (() => {
                const bullets = uniqueDefinitionBullets(
                  word.translation_zh ?? ""
                );
                if (bullets.length === 0) {
                  return (
                    <p className="text-[15px] leading-[1.55] text-muted-foreground font-sans">
                      No Chinese translation yet. Review auto-enriches when
                      possible, or add OPENAI_API_KEY for higher-quality
                      Chinese.
                    </p>
                  );
                }
                return (
                  <ul
                    className={cn(
                      fcListClass,
                      "text-primary font-medium min-h-[1.25rem]"
                    )}
                  >
                    {bullets.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                );
              })()}
            </FlashcardSection>

            <FlashcardEditableListSection
              title="Synonyms"
              sectionId="back_synonyms"
              field="synonyms"
              items={word.synonyms}
              sect={sect}
              browseEdit={browse}
              placeholder="e.g. happy, cheerful"
              emptyBrowse="No synonyms yet · tap pencil to add"
              draftText={relationListDraftText?.synonyms}
              initialLimit={3}
            />

            <FlashcardEditableListSection
              title="Antonyms"
              sectionId="back_antonyms"
              field="antonyms"
              items={word.antonyms}
              sect={sect}
              browseEdit={browse}
              placeholder="e.g. sad, bleak"
              emptyBrowse="No antonyms yet · tap pencil to add"
              draftText={relationListDraftText?.antonyms}
              initialLimit={3}
            />

            <FlashcardEditableListSection
              title="Collocations"
              sectionId="back_collocations"
              field="collocations"
              items={word.collocations}
              sect={sect}
              browseEdit={browse}
              placeholder="e.g. make a decision, strong wind"
              emptyBrowse="No collocations yet · tap pencil to add"
              draftText={relationListDraftText?.collocations}
              initialLimit={5}
            />

            {sect || browse ? (
              <FlashcardSection
                title="Example sentences"
                action={
                  browse ? (
                    <SectionEditLink
                      wordId={browse.wordId}
                      sectionId="back_examples"
                    />
                  ) : (
                    <SectionEditActions
                      isEditing={sect!.editingSectionId === "back_examples"}
                      disabledStart={sectionEditBlocked(
                        sect!.editingSectionId,
                        "back_examples"
                      )}
                      saving={sect!.sectionSaving}
                      onEdit={() => sect!.onStartSectionEdit("back_examples")}
                      onCancel={() => sect!.onCancelSectionEdit()}
                      onSave={() => sect!.onSaveTextSection("back_examples")}
                    />
                  )
                }
              >
                {sect && sect.editingSectionId === "back_examples" ? (
                  <label className="flex flex-col gap-1.5 text-xs font-sans text-muted-foreground">
                    One per line
                    <textarea
                      spellCheck={true}
                      value={word.example_sentences.join("\n")}
                      onChange={(e) =>
                        sect.onSectionFieldChange(
                          "examples",
                          e.target.value
                        )
                      }
                      placeholder="Example sentence…"
                      rows={5}
                      className={inlineTextareaCn}
                    />
                  </label>
                ) : word.example_sentences.length > 0 ? (
                  <ul className={cn(fcListClass, "text-foreground/80")}>
                    {word.example_sentences.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[15px] leading-snug text-muted-foreground font-sans italic">
                    No example sentences yet.
                  </p>
                )}
              </FlashcardSection>
            ) : word.example_sentences.length > 0 ? (
              <FlashcardSection title="Example sentences">
                <ul className={cn(fcListClass, "text-foreground/80")}>
                  {word.example_sentences.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </FlashcardSection>
            ) : null}

            {word.word.trim() ? (
              <FlashcardSection title="External resource">
                <ul className="flex flex-col gap-2 font-sans">
                  {externalDictionaryResources(word.word).map((resource) => (
                    <li key={resource.id}>
                      <a
                        href={resource.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2.5 text-sm font-medium text-primary hover:bg-muted/40 transition-colors"
                      >
                        <span className="min-w-0 flex-1 break-all">
                          {resource.label}
                        </span>
                        <ExternalLink
                          className="size-3.5 shrink-0 opacity-60"
                          aria-hidden
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </FlashcardSection>
            ) : null}
          </div>
        </>
      ) : (
        <div className="text-center space-y-1 sm:text-left">
          <h2 className="text-2xl font-bold tracking-tight font-sans">
            {word.word}
          </h2>
          <p className="text-sm font-mono text-muted-foreground font-sans min-h-[1.25rem]">
            {word.ipa || "—"}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="p-0 rounded-full h-8 w-8"
              onClick={() => playPronunciation(word)}
              aria-label="Pronounce"
            >
              <Volume2 className="size-4" />
            </Button>
            <a
              href={youglish}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-transparent hover:bg-muted transition-colors font-sans h-8 px-2 text-xs"
            >
              YouGlish <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      {!fc ? (
        <>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground uppercase tracking-wider font-sans text-xs">
              English explanation
            </p>
            <p className="text-muted-foreground leading-relaxed min-h-[1.25rem] font-sans text-sm">
              {word.definition?.trim() || (
                <span className="italic text-muted-foreground">
                  No English gloss yet. Review auto-enriches from Merriam-Webster
                  when possible.
                </span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-muted-foreground uppercase tracking-wider font-sans text-xs">
              Chinese
            </p>
            <p className="font-medium text-primary min-h-[1.25rem] font-sans text-sm">
              {word.translation_zh?.trim() || (
                <span className="text-muted-foreground font-normal">
                  Open the card in Review or My Words to auto-enrich, or add
                  OPENAI_API_KEY for higher-quality Chinese.
                </span>
              )}
            </p>
          </div>
        </>
      ) : null}

      {!fc && (
        <div className="space-y-4">
          <RelationListSection
            title="Synonyms"
            items={word.synonyms}
            fc={false}
            initialLimit={3}
          />
          <RelationListSection
            title="Antonyms"
            items={word.antonyms}
            fc={false}
            initialLimit={3}
          />
          <RelationListSection
            title="Collocations"
            items={word.collocations}
            fc={false}
            initialLimit={5}
          />
        </div>
      )}

      {!fc && word.example_sentences.length > 0 && (
        <div className="space-y-1">
          <p
            className={cn(
              "font-medium text-muted-foreground uppercase tracking-wider font-sans",
              fc ? "text-sm" : "text-xs"
            )}
          >
            Example sentences
          </p>
          <ul
            className={cn(
              "list-disc pl-5 space-y-1.5 font-sans text-muted-foreground",
              fc ? "text-base sm:text-lg leading-relaxed" : "text-sm"
            )}
          >
            {word.example_sentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {!fc && (
        <div className="flex flex-wrap gap-2 items-center">
          <CocaOrCustomBadge rank={word.rank} className="font-sans text-xs" />
          {word.word_family?.trim() && (
            <Badge variant="secondary" className="font-sans text-xs">
              Family: {word.word_family}
            </Badge>
          )}
          {word.category?.trim() && (
            <Badge variant="secondary" className="font-sans text-xs">
              {word.category}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
