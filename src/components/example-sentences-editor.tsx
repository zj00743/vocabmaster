"use client";

import { useCallback, useEffect, useRef } from "react";
import { Highlighter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wrapSelectionInHighlight } from "@/lib/example-sentence-highlight";
import { cn } from "@/lib/utils";

export function ExampleSentencesEditor({
  value,
  onChange,
  placeholder = "Example sentence…",
  rows,
  className,
  hint = "One sentence per line · select words, then tap Highlight",
  full = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  hint?: string;
  full?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useEffect(() => {
    const cursor = pendingCursorRef.current;
    const ta = textareaRef.current;
    if (cursor == null || !ta) return;
    pendingCursorRef.current = null;
    ta.focus();
    ta.setSelectionRange(cursor, cursor);
  }, [value]);

  const highlightSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = wrapSelectionInHighlight(
      value,
      ta.selectionStart,
      ta.selectionEnd
    );
    if (!result) return;
    pendingCursorRef.current = result.cursor;
    onChange(result.text);
  }, [value, onChange]);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 font-sans",
        full && "min-h-0 flex-1"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{hint}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
          onClick={highlightSelection}
        >
          <Highlighter className="size-3.5" aria-hidden />
          Highlight
        </Button>
      </div>
      <textarea
        ref={textareaRef}
        spellCheck
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
    </div>
  );
}
