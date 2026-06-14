"use client";

import { Volume2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type EntryType,
  isPhraseEntry,
  entryTypeBadgeLabel,
} from "@/lib/word-entry";
import type { WordEditSectionSlug } from "@/lib/word-section-meta";
import type { SectionFieldValues } from "@/lib/word-section-save";
import type { WordWithProgress } from "@/lib/types";
import { ExampleSentencesEditor } from "@/components/example-sentences-editor";
import { cn } from "@/lib/utils";
import { playPronunciation } from "@/lib/pronunciation";
import { TagPicker } from "@/components/tag-picker";

const boxedTextareaCn = cn(
  "flex min-h-[4.5rem] w-full rounded-lg border border-input bg-background px-3 py-2.5",
  "text-sm leading-relaxed font-sans resize-y outline-none placeholder:text-muted-foreground",
  "focus-visible:ring-ring/35 focus-visible:ring-[3px] focus-visible:border-ring"
);

const fullTextareaCn = cn(
  "min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-y-contain border-0 bg-transparent px-0 py-0",
  "text-base leading-relaxed font-sans outline-none placeholder:text-muted-foreground",
  "focus-visible:ring-0"
);

export function WordSectionEditForm({
  sectionId,
  word,
  values,
  onChange,
  layout = "fullscreen",
}: {
  sectionId: WordEditSectionSlug;
  word: WordWithProgress;
  values: SectionFieldValues;
  onChange: (patch: Partial<SectionFieldValues>) => void;
  layout?: "default" | "fullscreen";
}) {
  const full = layout === "fullscreen";
  const isExpression =
    values.entryType === "expression" || isPhraseEntry(values.lemma);
  const youglish = `https://youglish.com/pronounce/${encodeURIComponent(word.word)}/english`;

  switch (sectionId) {
    case "back_header":
      return (
        <div
          className={cn(
            "font-sans",
            full
              ? "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-y-contain"
              : "space-y-5"
          )}
        >
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            {word.is_custom ? (
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
                Word
                <Input
                  value={values.lemma}
                  onChange={(e) => onChange({ lemma: e.target.value })}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="text-2xl font-bold tracking-tight h-auto py-2"
                />
              </label>
            ) : (
              <p className="text-2xl font-bold tracking-tight break-words">
                {word.word}
              </p>
            )}
            {!isExpression ? (
              <label className="flex w-[7.5rem] flex-col gap-1.5 text-xs text-muted-foreground shrink-0">
                POS
                <Input
                  value={values.partOfSpeech}
                  onChange={(e) =>
                    onChange({ partOfSpeech: e.target.value })
                  }
                  className="capitalize text-sm h-10"
                  placeholder="noun"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex min-w-[8rem] max-w-full flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
              IPA
              <Input
                value={values.ipa}
                onChange={(e) => onChange({ ipa: e.target.value })}
                className="font-mono text-sm"
                placeholder="/…/"
              />
            </label>
            {!isExpression && (
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
            )}
            <a
              href={youglish}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-transparent hover:bg-muted/60 h-10 px-3 text-sm shrink-0"
            >
              YouGlish <ExternalLink className="size-3.5" />
            </a>
          </div>

          <TagPicker
            selectedIds={values.tagIds}
            onChange={(tagIds) => onChange({ tagIds })}
          />

          <label className="flex min-w-[7rem] max-w-sm flex-col gap-1.5 text-xs text-muted-foreground">
            Card type
            <Select
              value={values.entryType}
              onValueChange={(v) =>
                v && onChange({ entryType: v as EntryType })
              }
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue>
                  {entryTypeBadgeLabel(values.entryType)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="word">Word</SelectItem>
                <SelectItem value="expression">Expression</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="flex min-w-[7rem] max-w-sm flex-col gap-1.5 text-xs text-muted-foreground">
            Card image
            <Select
              value={values.showImage ? "on" : "off"}
              onValueChange={(v) => v && onChange({ showImage: v === "on" })}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue>
                  {values.showImage ? "Shown" : "Hidden"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on">Shown</SelectItem>
                <SelectItem value="off">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      );

    case "definition-en":
      return (
        <label
          className={cn(
            "flex flex-col gap-1.5 text-xs text-muted-foreground font-sans",
            full && "min-h-0 flex-1"
          )}
        >
          One sense per line · first line appears on card front
          <textarea
            spellCheck
            value={values.definition}
            onChange={(e) => onChange({ definition: e.target.value })}
            placeholder="One gloss per line"
            rows={
              full
                ? undefined
                : Math.min(
                    16,
                    Math.max(6, values.definition.split("\n").length + 2)
                  )
            }
            className={full ? fullTextareaCn : cn(boxedTextareaCn, "min-h-[10rem]")}
          />
        </label>
      );

    case "definition-zh":
      return (
        <label
          className={cn(
            "flex flex-col gap-1.5 text-xs text-muted-foreground font-sans",
            full && "min-h-0 flex-1"
          )}
        >
          One line per bullet if using multiple glosses
          <textarea
            value={values.translationZh}
            onChange={(e) => onChange({ translationZh: e.target.value })}
            placeholder="中文释义…"
            rows={
              full
                ? undefined
                : Math.min(
                    10,
                    Math.max(4, values.translationZh.split("\n").length + 2)
                  )
            }
            className={full ? fullTextareaCn : boxedTextareaCn}
          />
        </label>
      );

    case "back_definition":
      return (
        <div
          className={cn(
            "font-sans",
            full
              ? "flex min-h-0 flex-1 flex-col gap-4"
              : "space-y-5"
          )}
        >
          <label
            className={cn(
              "flex flex-col gap-1.5 text-xs text-muted-foreground",
              full && "min-h-0 flex-1"
            )}
          >
            English · first line appears on card front · one sense per line
            <textarea
              spellCheck
              value={values.definition}
              onChange={(e) => onChange({ definition: e.target.value })}
              placeholder="One gloss per line"
              rows={full ? undefined : Math.min(16, Math.max(6, values.definition.split("\n").length + 2))}
              className={full ? fullTextareaCn : cn(boxedTextareaCn, "min-h-[10rem]")}
            />
          </label>
          <label
            className={cn(
              "flex flex-col gap-1.5 text-xs text-muted-foreground",
              full && "min-h-0 flex-1"
            )}
          >
            中文 · one line per bullet if using multiple glosses
            <textarea
              value={values.translationZh}
              onChange={(e) => onChange({ translationZh: e.target.value })}
              rows={full ? undefined : Math.min(10, Math.max(4, values.translationZh.split("\n").length + 2))}
              className={full ? fullTextareaCn : boxedTextareaCn}
            />
          </label>
        </div>
      );

    case "back_synonyms":
    case "back_antonyms":
    case "back_collocations": {
      const field =
        sectionId === "back_synonyms"
          ? "synonymsText"
          : sectionId === "back_antonyms"
            ? "antonymsText"
            : "collocationsText";
      const text = values[field];
      const placeholder =
        sectionId === "back_synonyms"
          ? "e.g. happy, cheerful"
          : sectionId === "back_antonyms"
            ? "e.g. sad, bleak"
            : "e.g. make a decision, strong wind";
      return (
        <label
          className={cn(
            "flex flex-col gap-1.5 text-xs text-muted-foreground font-sans",
            full && "min-h-0 flex-1"
          )}
        >
          One phrase per line
          <textarea
            spellCheck
            value={text}
            onChange={(e) => onChange({ [field]: e.target.value })}
            placeholder={placeholder}
            rows={full ? undefined : Math.min(12, Math.max(6, text.split("\n").length + 3))}
            className={full ? fullTextareaCn : boxedTextareaCn}
          />
        </label>
      );
    }

    case "back_examples":
      return (
        <ExampleSentencesEditor
          value={values.examplesText}
          onChange={(examplesText) => onChange({ examplesText })}
          placeholder="Example sentence…"
          full={full}
          rows={
            full
              ? undefined
              : Math.min(
                  12,
                  Math.max(6, values.examplesText.split("\n").length + 3)
                )
          }
          className={full ? fullTextareaCn : boxedTextareaCn}
        />
      );

    case "back_unnatural_english":
      return (
        <ExampleSentencesEditor
          value={values.unnaturalEnglishText}
          onChange={(unnaturalEnglishText) => onChange({ unnaturalEnglishText })}
          placeholder="Unnatural or incorrect English usage…"
          full={full}
          rows={
            full
              ? undefined
              : Math.min(
                  12,
                  Math.max(6, values.unnaturalEnglishText.split("\n").length + 3)
                )
          }
          className={full ? fullTextareaCn : boxedTextareaCn}
        />
      );

    default:
      return null;
  }
}
