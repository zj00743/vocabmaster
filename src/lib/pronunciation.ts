/** Play word audio from dictionary URL when available, else browser TTS. */

export function canUseSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakWord(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const t = text.trim();
  if (!t) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function canPlayPronunciation(word: {
  word: string;
  pronunciation_url?: string | null;
}): boolean {
  if (!word.word.trim()) return false;
  if (word.pronunciation_url?.trim()) return true;
  return canUseSpeechSynthesis();
}

export function playPronunciation(word: {
  word: string;
  pronunciation_url?: string | null;
}) {
  const url = word.pronunciation_url?.trim();
  if (url && typeof window !== "undefined") {
    cancelSpeech();
    const audio = new Audio(url);
    audio.play().catch(() => speakWord(word.word));
    return;
  }
  speakWord(word.word);
}
