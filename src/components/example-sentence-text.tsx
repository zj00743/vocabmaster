"use client";

import { parseExampleSentenceParts } from "@/lib/example-sentence-highlight";
import { cn } from "@/lib/utils";

export function ExampleSentenceText({
  text,
  className,
  highlightClassName,
}: {
  text: string;
  className?: string;
  highlightClassName?: string;
}) {
  const parts = parseExampleSentenceParts(text);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "highlight" ? (
          <mark
            key={i}
            className={cn(
              "rounded-sm bg-amber-200/80 px-0.5 font-medium text-foreground dark:bg-amber-500/35",
              highlightClassName
            )}
          >
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </span>
  );
}
