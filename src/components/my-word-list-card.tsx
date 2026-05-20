"use client";

import type { ReactNode } from "react";
import { Check, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CocaOrCustomBadge } from "@/components/word-entry-badges";
import { canPlayPronunciation, playPronunciation } from "@/lib/pronunciation";
import type { WordWithProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  learning: "bg-orange-100 text-orange-700",
  review: "bg-purple-100 text-purple-700",
  mastered: "bg-emerald-100 text-emerald-700",
};

export function formatWordListDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface MyWordListCardProps {
  word: WordWithProgress;
  onClick?: () => void;
  actions?: ReactNode;
  /** Selection mode: when true, render a checkbox and ignore `onClick` for the regular flashcard open. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function MyWordListCard({
  word,
  onClick,
  actions,
  selectable,
  selected,
  onToggleSelect,
}: MyWordListCardProps) {
  const handleClick = selectable ? onToggleSelect : onClick;
  const isInteractive = !!handleClick;
  return (
    <Card
      size="sm"
      className={cn(
        "w-full text-left",
        isInteractive && "cursor-pointer hover:ring-primary/20 transition-shadow",
        selectable && selected && "ring-2 ring-primary/60 bg-primary/5"
      )}
      onClick={handleClick}
    >
      <CardContent className="flex items-center gap-1.5 px-3 py-2">
        {selectable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={!!selected}
            aria-label={selected ? `Deselect ${word.word}` : `Select ${word.word}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={cn(
              "shrink-0 inline-flex items-center justify-center size-5 rounded border transition-colors",
              selected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/50"
            )}
          >
            {selected && <Check className="size-3.5" aria-hidden />}
          </button>
        )}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <p className="text-sm font-medium truncate leading-tight">{word.word}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            disabled={!canPlayPronunciation(word)}
            aria-label={`Listen to ${word.word}`}
            title={
              word.pronunciation_url?.trim()
                ? "Play dictionary audio"
                : "Play pronunciation"
            }
            onClick={(e) => {
              e.stopPropagation();
              playPronunciation(word);
            }}
          >
            <Volume2 className="size-3.5" aria-hidden />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <CocaOrCustomBadge
            rank={word.rank}
            className="text-[10px] px-1.5 py-0"
          />
          {word.progress && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0",
                statusColors[word.progress.status]
              )}
            >
              {word.progress.status}
            </Badge>
          )}
          {word.progress?.next_review && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatWordListDate(word.progress.next_review)}
            </span>
          )}
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}
