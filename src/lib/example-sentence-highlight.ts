/** Stored highlight syntax: ==word or phrase== */

const HIGHLIGHT_PATTERN = /==([^=]+)==/g;

export function wrapSelectionInHighlight(
  text: string,
  start: number,
  end: number
): { text: string; cursor: number } | null {
  if (start === end) return null;
  const selected = text.slice(start, end);
  if (!selected.trim()) return null;
  const wrapped = `==${selected}==`;
  return {
    text: text.slice(0, start) + wrapped + text.slice(end),
    cursor: start + wrapped.length,
  };
}

export type ExampleSentencePart =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string };

/** Split a sentence into plain and highlighted segments for rendering. */
export function parseExampleSentenceParts(sentence: string): ExampleSentencePart[] {
  const parts: ExampleSentencePart[] = [];
  let lastIndex = 0;
  const re = new RegExp(HIGHLIGHT_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(sentence)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: sentence.slice(lastIndex, match.index) });
    }
    parts.push({ type: "highlight", value: match[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < sentence.length) {
    parts.push({ type: "text", value: sentence.slice(lastIndex) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: sentence });
  }
  return parts;
}
