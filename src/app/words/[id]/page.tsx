"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flashcard } from "@/components/flashcard";
import { FsrsForgettingCurvePanel } from "@/components/fsrs-forgetting-curve";
import type {
  FlashcardInlineEditField,
  WordCardEditSectionId,
  WordCardTextSectionId,
} from "@/lib/word-card-edit-types";
import type { WordWithProgress } from "@/lib/types";
import { needsAutoEnrich } from "@/lib/enrich-utils";
import { normalizeWord } from "@/lib/word-utils";

function examplesToText(arr: string[]): string {
  return arr.filter(Boolean).join("\n");
}

type SectionFieldSnapshot = Partial<
  Record<FlashcardInlineEditField, string>
>;

function WordEditorInner() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const editingSectionRef = useRef<WordCardEditSectionId | null>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingSection, setEditingSection] =
    useState<WordCardEditSectionId | null>(null);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const [word, setWord] = useState<WordWithProgress | null>(null);

  const [lemma, setLemma] = useState("");
  const [definition, setDefinition] = useState("");
  const [translationZh, setTranslationZh] = useState("");
  const [examplesText, setExamplesText] = useState("");
  const [synonymsText, setSynonymsText] = useState("");
  const [antonymsText, setAntonymsText] = useState("");
  const [collocationsText, setCollocationsText] = useState("");
  const [category, setCategory] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [ipa, setIpa] = useState("");

  const sectionSnapRef = useRef<SectionFieldSnapshot>({});

  useEffect(() => {
    editingSectionRef.current = editingSection;
  }, [editingSection]);

  const hydrateFromWord = useCallback((w: WordWithProgress) => {
    const n = normalizeWord(w);
    setLemma(n.word ?? "");
    setDefinition(n.definition ?? "");
    setTranslationZh(n.translation_zh ?? "");
    setExamplesText(examplesToText(n.example_sentences));
    setSynonymsText(examplesToText(n.synonyms));
    setAntonymsText(examplesToText(n.antonyms));
    setCollocationsText(examplesToText(n.collocations));
    setCategory((n.category ?? "").trim());
    setPartOfSpeech((n.part_of_speech ?? "").trim());
    setIpa((n.ipa ?? "").trim());
    setEditingSection(null);
    editingSectionRef.current = null;
    sectionSnapRef.current = {};
    setWord(n);
  }, []);

  const loadWord = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/words/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setWord(null);
        return;
      }
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      const progRaw = data.progress as unknown;
      const progress = Array.isArray(progRaw)
        ? progRaw[0] ?? undefined
        : progRaw ?? undefined;
      const merged = normalizeWord({
        ...data,
        progress,
      } as WordWithProgress);
      hydrateFromWord(merged);
    } catch {
      toast.error("Could not load word");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, hydrateFromWord]);

  useEffect(() => {
    void loadWord();
  }, [loadWord]);

  /* Auto-enrich once when this word finishes loading (id stable afterward). */
  useEffect(() => {
    if (!word || !needsAutoEnrich(word)) return;
    let cancelled = false;
    setEnriching(true);
    fetch(`/api/words/${word.id}/enrich`, { method: "POST" })
      .then((r) => r.json())
      .then((json: { word?: WordWithProgress }) => {
        if (cancelled || !json?.word) return;
        hydrateFromWord(
          normalizeWord({ ...json.word, progress: word.progress })
        );
        toast.success("Card updated from dictionary");
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setEnriching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [word?.id, hydrateFromWord]);

  const previewWord = useMemo((): WordWithProgress | null => {
    if (!word) return null;
    const ex = examplesText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sy = synonymsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const an = antonymsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const co = collocationsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return normalizeWord({
      ...word,
      word: word.is_custom ? lemma.trim() || word.word : word.word,
      definition: definition.trim(),
      translation_zh: translationZh.trim(),
      category: category.trim() || word.category || null,
      part_of_speech: partOfSpeech.trim(),
      ipa: ipa.trim(),
      example_sentences: ex,
      synonyms: sy,
      antonyms: an,
      collocations: co,
    });
  }, [
    word,
    lemma,
    definition,
    translationZh,
    examplesText,
    synonymsText,
    antonymsText,
    collocationsText,
    category,
    partOfSpeech,
    ipa,
  ]);

  const onSectionFieldChange = useCallback(
    (field: FlashcardInlineEditField, value: string) => {
      switch (field) {
        case "lemma":
          setLemma(value);
          break;
        case "definition":
          setDefinition(value);
          break;
        case "translation_zh":
          setTranslationZh(value);
          break;
        case "examples":
          setExamplesText(value);
          break;
        case "category":
          setCategory(value);
          break;
        case "part_of_speech":
          setPartOfSpeech(value);
          break;
        case "ipa":
          setIpa(value);
          break;
        case "synonyms":
          setSynonymsText(value);
          break;
        case "antonyms":
          setAntonymsText(value);
          break;
        case "collocations":
          setCollocationsText(value);
          break;
        default:
          break;
      }
    },
    []
  );

  const onStartSectionEdit = useCallback(
    (sectionId: WordCardEditSectionId) => {
      if (
        editingSectionRef.current !== null &&
        editingSectionRef.current !== sectionId
      ) {
        toast.info(
          "Save or cancel the section you're editing before opening another."
        );
        return;
      }

      const snap: SectionFieldSnapshot = {};
      switch (sectionId) {
        case "back_header":
          snap.lemma = lemma;
          snap.category = category;
          snap.part_of_speech = partOfSpeech;
          snap.ipa = ipa;
          break;
        case "back_definition":
          snap.definition = definition;
          snap.translation_zh = translationZh;
          break;
        case "back_examples":
          snap.examples = examplesText;
          break;
        case "back_synonyms":
          snap.synonyms = synonymsText;
          break;
        case "back_antonyms":
          snap.antonyms = antonymsText;
          break;
        case "back_collocations":
          snap.collocations = collocationsText;
          break;
        default:
          break;
      }
      sectionSnapRef.current = snap;
      setEditingSection(sectionId);
    },
    [
      lemma,
      category,
      partOfSpeech,
      ipa,
      definition,
      translationZh,
      examplesText,
      synonymsText,
      antonymsText,
      collocationsText,
    ]
  );

  const onCancelSectionEdit = useCallback(() => {
    const s = sectionSnapRef.current;
    if (s.lemma !== undefined) setLemma(s.lemma);
    if (s.definition !== undefined) setDefinition(s.definition);
    if (s.translation_zh !== undefined) setTranslationZh(s.translation_zh);
    if (s.examples !== undefined) setExamplesText(s.examples);
    if (s.synonyms !== undefined) setSynonymsText(s.synonyms);
    if (s.antonyms !== undefined) setAntonymsText(s.antonyms);
    if (s.collocations !== undefined) setCollocationsText(s.collocations);
    if (s.category !== undefined) setCategory(s.category);
    if (s.part_of_speech !== undefined) setPartOfSpeech(s.part_of_speech);
    if (s.ipa !== undefined) setIpa(s.ipa);
    sectionSnapRef.current = {};
    setEditingSection(null);
  }, []);

  const onSaveTextSection = useCallback(
    async (sectionId: WordCardTextSectionId) => {
      if (!word) return;
      setSectionSaving(true);
      try {
        const payload: Record<string, unknown> = {};
        switch (sectionId) {
          case "back_header":
            payload.ipa = ipa.trim();
            payload.category = category.trim() || "";
            payload.part_of_speech = partOfSpeech.trim();
            if (word.is_custom) payload.word = lemma.trim() || word.word;
            break;
          case "back_definition":
            payload.definition = definition.trim();
            payload.translation_zh = translationZh.trim();
            break;
          case "back_examples":
            payload.example_sentences = examplesText
              .split(/\n/)
              .map((line) => line.trim())
              .filter(Boolean);
            break;
          case "back_synonyms":
            payload.synonyms = synonymsText
              .split(/\n/)
              .map((line) => line.trim())
              .filter(Boolean);
            break;
          case "back_antonyms":
            payload.antonyms = antonymsText
              .split(/\n/)
              .map((line) => line.trim())
              .filter(Boolean);
            break;
          case "back_collocations":
            payload.collocations = collocationsText
              .split(/\n/)
              .map((line) => line.trim())
              .filter(Boolean);
            break;
          default:
            break;
        }

        const res = await fetch(`/api/words/${word.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(
            typeof err?.error === "string" ? err.error : "Save failed"
          );
          return;
        }

        const data = await res.json();
        hydrateFromWord(
          normalizeWord({
            ...data,
            progress: word.progress ?? undefined,
          } as WordWithProgress)
        );
        toast.success("Section saved");
      } catch {
        toast.error("Save failed");
      } finally {
        setSectionSaving(false);
      }
    },
    [
      word,
      lemma,
      category,
      partOfSpeech,
      ipa,
      definition,
      translationZh,
      examplesText,
      synonymsText,
      antonymsText,
      collocationsText,
      hydrateFromWord,
    ]
  );

  const sectionEdit = useMemo(
    () =>
      previewWord && word
        ? {
            editingSectionId: editingSection,
            sectionSaving,
            onStartSectionEdit,
            onCancelSectionEdit,
            onSaveTextSection,
            onSectionFieldChange,
          }
        : undefined,
    [
      previewWord,
      word,
      editingSection,
      sectionSaving,
      onStartSectionEdit,
      onCancelSectionEdit,
      onSaveTextSection,
      onSectionFieldChange,
    ]
  );

  const mergeImage = useCallback((nextUrl: string | null) => {
    setWord((prev) => (prev ? { ...prev, image_url: nextUrl } : null));
  }, []);

  if (!id) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
          Invalid link.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8 space-y-6 pb-28">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/words">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="size-4" />
              My Words
            </Button>
          </Link>
          {previewWord && (
            <>
              <h1 className="text-lg font-semibold tracking-tight truncate min-w-0 flex-1 basis-full sm:basis-auto">
                Edit · {previewWord.word}
              </h1>
              <p className="w-full basis-full text-xs text-muted-foreground leading-snug -mt-0.5">
                Flip the card to edit word details, glosses, and examples — only the
                image is edited from the front.
              </p>
            </>
          )}
        </header>

        {loading && (
          <div className="py-24 text-center text-muted-foreground animate-pulse">
            Loading card…
          </div>
        )}

        {!loading && notFound && (
          <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
            <p className="text-muted-foreground">Word not found.</p>
            <Link href="/words">
              <Button variant="outline">Back to My Words</Button>
            </Link>
          </div>
        )}

        {!loading && previewWord && (
          <Tabs defaultValue="flashcard" className="w-full gap-4">
            <TabsList className="w-full max-w-md">
              <TabsTrigger value="flashcard" className="flex-1 font-sans">
                Flash card
              </TabsTrigger>
              <TabsTrigger value="memory-curve" className="flex-1 font-sans">
                Memory curve
              </TabsTrigger>
            </TabsList>

            <TabsContent value="flashcard" className="mt-0 outline-none">
              <Flashcard
                key={previewWord.id}
                word={previewWord}
                showAnswer={showAnswer}
                onFlip={() => setShowAnswer((s) => !s)}
                onRate={() => {
                  toast.info(
                    "Rate cards from the Review tab to update FSRS scheduling."
                  );
                }}
                enriching={enriching}
                onWordImageUpdate={(wid, url) => {
                  if (wid !== previewWord.id) return;
                  mergeImage(url);
                }}
                showRatingBar={false}
                sectionEdit={sectionEdit}
                relationListDraftText={{
                  synonyms: synonymsText,
                  antonyms: antonymsText,
                  collocations: collocationsText,
                }}
              />
            </TabsContent>

            <TabsContent value="memory-curve" className="mt-0 outline-none">
              {previewWord.progress ? (
                <FsrsForgettingCurvePanel progress={previewWord.progress} />
              ) : (
                <p className="rounded-xl border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground font-sans leading-relaxed">
                  No review history yet. Rate this word in Review to build a
                  memory curve.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

export default function WordDetailPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
            Loading…
          </div>
        </AppShell>
      }
    >
      <WordEditorInner />
    </Suspense>
  );
}
