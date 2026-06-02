"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search as SearchIcon,
  Sparkles,
  Plus,
  Loader2,
  Check,
  Mic,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { CocaOrCustomBadge } from "@/components/word-entry-badges";
import { isPhraseEntry } from "@/lib/word-entry";
import { Flashcard } from "@/components/flashcard";
import {
  CustomWordDraftDialog,
  type CustomWordDraftSeed,
} from "@/components/custom-word-draft-dialog";
import { toast } from "sonner";
import type { LearningProgress, Word, WordWithProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";
import { needsAutoEnrich } from "@/lib/enrich-utils";

/** Search results from `/api/search` come pre-joined with the user's `learning_progress` row (or null). */
type SearchResult = Word & { progress?: LearningProgress | null };

function isUuid(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedWord, setGeneratedWord] = useState<Word | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [flashcardWord, setFlashcardWord] = useState<WordWithProgress | null>(
    null
  );
  const [showAnswer, setShowAnswer] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftSeed, setDraftSeed] = useState<CustomWordDraftSeed | null>(null);

  const handleVoiceResult = useCallback((transcript: string) => {
    /* Spoken words tend to come back capitalized/punctuated; normalize for search. */
    const cleaned = transcript
      .replace(/[.,!?;:]+$/g, "")
      .trim()
      .toLowerCase();
    if (cleaned) setQuery(cleaned);
  }, []);

  const handleVoiceInterim = useCallback((transcript: string) => {
    const cleaned = transcript.replace(/[.,!?;:]+$/g, "").trim().toLowerCase();
    if (cleaned) setQuery(cleaned);
  }, []);

  const {
    supported: voiceSupported,
    listening,
    toggle: toggleVoice,
  } = useSpeechRecognition({
    onResult: handleVoiceResult,
    onInterim: handleVoiceInterim,
    onError: (err) => {
      if (err === "not-allowed" || err === "service-not-allowed") {
        toast.error("Microphone access was blocked. Enable it to use voice input.");
      } else if (err !== "aborted" && err !== "no-speech") {
        toast.error("Voice input failed. Try again.");
      }
    },
  });

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setGeneratedWord(null);
      return;
    }
    setSearching(true);
    setGeneratedWord(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const list: SearchResult[] = Array.isArray(data)
          ? (data as SearchResult[])
          : ((data.words ?? []) as SearchResult[]);
        setResults(list);
      }
    } catch {
      // API not available
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const openFlashcard = useCallback((w: WordWithProgress) => {
    setFlashcardWord(normalizeWord(w));
    setShowAnswer(false);
  }, []);

  const closeFlashcard = useCallback(() => {
    setFlashcardWord(null);
    setShowAnswer(false);
    setEnrichingId(null);
  }, []);

  /** Auto-enrich newly opened cards in the modal so the back fills in. */
  const flashcardWordId = flashcardWord?.id;
  useEffect(() => {
    if (!flashcardWordId || !flashcardWord) return;
    if (!needsAutoEnrich(flashcardWord)) return;

    let cancelled = false;
    setEnrichingId(flashcardWordId);
    fetch(`/api/words/${flashcardWordId}/enrich`, { method: "POST" })
      .then((r) => r.json())
      .then((json: { word?: WordWithProgress }) => {
        if (cancelled || !json?.word) return;
        setFlashcardWord((prev) =>
          prev?.id === flashcardWordId
            ? normalizeWord({ ...prev, ...json.word } as WordWithProgress)
            : prev
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setEnrichingId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [flashcardWordId, flashcardWord]);

  const queryNorm = query.trim().toLowerCase();
  const inCorpusBank = useMemo(
    () =>
      queryNorm.length > 0 &&
      results.some((w) => w.word.trim().toLowerCase() === queryNorm),
    [results, queryNorm]
  );
  const showManualAdd =
    !searching && queryNorm.length > 0 && !inCorpusBank && !generatedWord;

  const openDraftReview = useCallback((seed: CustomWordDraftSeed) => {
    setDraftSeed(seed);
    setDraftOpen(true);
  }, []);

  const handleAddManually = () => {
    const lemma = query.trim();
    if (!lemma) return;
    openDraftReview({ lemma });
  };

  const handleDraftConfirmed = useCallback(
    (saved: Word) => {
      setSavedIds((prev) => new Set(prev).add(saved.id));
      setGeneratedWord(null);
      toast.success(`"${saved.word}" added to My Words`);
      openFlashcard(saved as WordWithProgress);
      void fetch(`/api/words/${saved.id}/enrich`, { method: "POST" })
        .then((r) => r.json())
        .then((json: { word?: WordWithProgress }) => {
          if (!json?.word) return;
          setFlashcardWord((prev) =>
            prev?.id === saved.id
              ? normalizeWord({ ...prev, ...json.word } as WordWithProgress)
              : prev
          );
        })
        .catch(() => undefined);
    },
    [openFlashcard]
  );

  const openGeneratedDraft = () => {
    if (!generatedWord) return;
    openDraftReview({
      lemma: generatedWord.word.trim() || query.trim(),
      definition: generatedWord.definition,
      translation_zh: generatedWord.translation_zh,
      ipa: generatedWord.ipa,
      part_of_speech: generatedWord.part_of_speech,
      category: generatedWord.category,
      example_sentences: generatedWord.example_sentences,
      synonyms: generatedWord.synonyms,
      antonyms: generatedWord.antonyms,
      collocations: generatedWord.collocations,
      image_url: generatedWord.image_url,
      image_prompt: generatedWord.image_prompt,
    });
  };

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: query.trim() }),
      });
      if (res.ok) {
        const word = await res.json();
        setGeneratedWord(word);
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Failed to generate word");
      }
    } catch {
      toast.error("Failed to generate word");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (word: Word) => {
    const key = word.id ?? word.word;
    setSavingKey(key);
    try {
      const alreadyInCorpus = isUuid(word.id) && !word.is_custom;

      if (alreadyInCorpus) {
        const pr = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word_id: word.id }),
        });
        if (pr.ok || pr.status === 409) {
          setSavedIds((prev) => new Set(prev).add(word.id!));
          toast.success(`"${word.word}" added to your words`);
          openFlashcard(word as WordWithProgress);
          void fetch(`/api/words/${word.id}/enrich`, { method: "POST" }).catch(
            () => undefined
          );
        } else {
          const j = (await pr.json().catch(() => ({}))) as { error?: string };
          toast.error(j.error ?? "Could not add word");
        }
        return;
      }

      const { id: _omit, ...payload } = word;
      const wordRes = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: payload.word,
          definition: payload.definition ?? "",
          translation_zh: payload.translation_zh ?? "",
          ipa: payload.ipa ?? "",
          part_of_speech: payload.part_of_speech ?? "",
          example_sentences: payload.example_sentences ?? [],
          synonyms: payload.synonyms ?? [],
          antonyms: payload.antonyms ?? [],
          collocations: payload.collocations ?? [],
          image_url: payload.image_url,
          image_prompt: payload.image_prompt,
          mnemonic: payload.mnemonic,
          category: payload.category,
          rank: payload.rank,
          word_family: payload.word_family,
        }),
      });
      if (wordRes.ok) {
        const saved = (await wordRes.json()) as Word;
        const prog = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word_id: saved.id }),
        });
        if (!prog.ok && prog.status !== 409) {
          const j = (await prog.json().catch(() => ({}))) as { error?: string };
          toast.error(j.error ?? "Word saved but progress failed");
          return;
        }
        setSavedIds((prev) => new Set(prev).add(saved.id));
        toast.success(`"${word.word}" added to your words`);
        openFlashcard(saved as WordWithProgress);
        void fetch(`/api/words/${saved.id}/enrich`, { method: "POST" }).catch(
          () => undefined
        );
      } else {
        const j = (await wordRes.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Failed to save word");
      }
    } catch {
      toast.error("Failed to save word");
    } finally {
      setSavingKey(null);
    }
  };

  const isSaving = (w: Word) => savingKey === (w.id ?? w.word);
  const isSaved = (w: SearchResult) => {
    if (w.id && savedIds.has(w.id)) return true;
    return Boolean(w.progress);
  };

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl mx-auto w-full space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Add Word</h1>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              listening ? "Listening…" : "Search for a word or phrase…"
            }
            className={cn("pl-10 h-12 text-base", voiceSupported && "pr-12")}
          />
          {voiceSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              aria-label={listening ? "Stop voice input" : "Add word by voice"}
              aria-pressed={listening}
              className={cn(
                "absolute right-1.5 top-1/2 size-9 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground",
                listening &&
                  "bg-red-500/10 text-red-500 hover:text-red-600 hover:bg-red-500/15"
              )}
            >
              <Mic
                className={cn("size-5", listening && "animate-pulse")}
              />
            </Button>
          )}
        </div>

        {searching && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {showManualAdd && results.length > 0 && (
          <Card size="sm" className="border-dashed bg-muted/20">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground text-left">
                <span className="font-medium text-foreground">
                  &quot;{query.trim()}&quot;
                </span>{" "}
                is not in the word bank. Add it to My Words as a custom card.
              </p>
              <Button
                type="button"
                className="shrink-0 w-full sm:w-auto"
                disabled={savingKey === query.trim() || generating}
                onClick={() => void handleAddManually()}
              >
                {savingKey === query.trim() ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="size-4 mr-1.5" />
                )}
                Add manually
              </Button>
            </CardContent>
          </Card>
        )}

        {!searching && results.length > 0 && (
          <div className="space-y-2">
            {results.map((word) => {
              const saved = isSaved(word);
              return (
                <Card key={word.id ?? word.word} size="sm">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{word.word}</p>
                        {!isPhraseEntry(word.word) && word.part_of_speech?.trim() ? (
                          <span className="text-xs text-muted-foreground">
                            {word.part_of_speech}
                          </span>
                        ) : null}
                        <CocaOrCustomBadge
                          rank={word.rank}
                          className="text-[10px] px-1.5 py-0"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {word.definition}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={saved ? "secondary" : "default"}
                      disabled={saved || isSaving(word)}
                      onClick={() => handleSave(word)}
                      className="shrink-0"
                    >
                      {isSaving(word) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : saved ? (
                        <>
                          <Check className="size-4 mr-1" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-4 mr-1" /> Add
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {showManualAdd && results.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              &quot;{query.trim()}&quot; is not in the word bank.
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                disabled={generating || savingKey === query.trim()}
                onClick={() => void handleAddManually()}
              >
                {savingKey === query.trim() ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="size-4 mr-1.5" />
                )}
                Add manually
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerate}
                disabled={generating || savingKey === query.trim()}
                className="gap-2"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate with AI
              </Button>
            </div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto px-2">
              Add manually saves the word or phrase to My Words. You can edit
              the card on the back. Generate with AI optionally fills more
              fields (requires OpenAI).
            </p>
          </div>
        )}

        {generatedWord && (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  AI Generated
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold">{generatedWord.word}</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {generatedWord.ipa}
                </p>
              </div>
              <p className="text-sm font-medium">{generatedWord.translation_zh}</p>
              <p className="text-sm text-muted-foreground">
                {generatedWord.definition}
              </p>
              {generatedWord.example_sentences?.length > 0 && (
                <p className="text-sm italic text-muted-foreground">
                  {generatedWord.example_sentences[0]}
                </p>
              )}
              <Button
                type="button"
                onClick={openGeneratedDraft}
                className="w-full"
              >
                <Plus className="size-4 mr-2" />
                Review &amp; add to My Words
              </Button>
            </CardContent>
          </Card>
        )}

        {!query && (
          <div className="text-center py-12">
            <SearchIcon className="size-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              Search for English words to add to your collection
            </p>
          </div>
        )}
      </div>

      <CustomWordDraftDialog
        open={draftOpen}
        onOpenChange={setDraftOpen}
        seed={draftSeed}
        onConfirmed={handleDraftConfirmed}
      />

      <Dialog
        open={!!flashcardWord}
        onOpenChange={(open) => {
          if (!open) closeFlashcard();
        }}
      >
        <DialogContent
          className="gap-4 sm:max-w-3xl max-h-[min(96vh,900px)] overflow-y-auto p-4 sm:p-6"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{flashcardWord?.word ?? "Flashcard"}</DialogTitle>
          </DialogHeader>
          {flashcardWord ? (
            <Flashcard
              key={flashcardWord.id}
              word={flashcardWord}
              showAnswer={showAnswer}
              onFlip={() => setShowAnswer((s) => !s)}
              onRate={() => undefined}
              showRatingBar={false}
              enriching={enrichingId === flashcardWord.id}
              onWordImageUpdate={(wordId, imageUrl) => {
                setFlashcardWord((prev) =>
                  prev?.id === wordId
                    ? { ...prev, image_url: imageUrl }
                    : prev
                );
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
