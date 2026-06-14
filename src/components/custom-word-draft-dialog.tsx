"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Flashcard } from "@/components/flashcard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  FlashcardInlineEditField,
  WordCardEditSectionId,
  WordCardTextSectionId,
} from "@/lib/word-card-edit-types";
import type { Word, WordWithProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";
import { useTags } from "@/components/tag-picker";
import type { TagWithCount } from "@/lib/tags";

const DRAFT_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000001";

type SectionFieldSnapshot = Partial<Record<FlashcardInlineEditField, string>>;

function examplesToText(arr: string[] | undefined): string {
  return (arr ?? []).filter(Boolean).join("\n");
}

function linesToArray(text: string): string[] {
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CustomWordDraftSeed = {
  lemma: string;
  definition?: string;
  translation_zh?: string;
  ipa?: string;
  part_of_speech?: string;
  tag_ids?: string[];
  example_sentences?: string[];
  unnatural_english?: string[];
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  image_url?: string | null;
  image_prompt?: string | null;
};

export function CustomWordDraftDialog({
  open,
  onOpenChange,
  seed,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: CustomWordDraftSeed | null;
  onConfirmed: (word: Word) => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);

  const [lemma, setLemma] = useState("");
  const [definition, setDefinition] = useState("");
  const [translationZh, setTranslationZh] = useState("");
  const [examplesText, setExamplesText] = useState("");
  const [unnaturalEnglishText, setUnnaturalEnglishText] = useState("");
  const [synonymsText, setSynonymsText] = useState("");
  const [antonymsText, setAntonymsText] = useState("");
  const [collocationsText, setCollocationsText] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const { tags } = useTags(true);
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [ipa, setIpa] = useState("");

  const [editingSection, setEditingSection] =
    useState<WordCardEditSectionId | null>(null);
  const editingSectionRef = useRef<WordCardEditSectionId | null>(null);
  const sectionSnapRef = useRef<SectionFieldSnapshot>({});

  useEffect(() => {
    editingSectionRef.current = editingSection;
  }, [editingSection]);

  const resetFromSeed = useCallback((s: CustomWordDraftSeed) => {
    setLemma(s.lemma.trim());
    setDefinition(s.definition?.trim() ?? "");
    setTranslationZh(s.translation_zh?.trim() ?? "");
    setExamplesText(examplesToText(s.example_sentences));
    setUnnaturalEnglishText(examplesToText(s.unnatural_english));
    setSynonymsText(examplesToText(s.synonyms));
    setAntonymsText(examplesToText(s.antonyms));
    setCollocationsText(examplesToText(s.collocations));
    setTagIds(Array.isArray(s.tag_ids) ? s.tag_ids : []);
    setPartOfSpeech((s.part_of_speech ?? "").trim());
    setIpa((s.ipa ?? "").trim());
    setEditingSection(null);
    sectionSnapRef.current = {};
    setShowAnswer(false);
  }, []);

  useEffect(() => {
    if (!open || !seed) return;
    resetFromSeed(seed);

    const w = seed.lemma.trim();
    if (!w || seed.definition?.trim()) return;

    let cancelled = false;
    setHintLoading(true);
    fetch(`/api/dictionary-hint?word=${encodeURIComponent(w)}`)
      .then((r) => r.json())
      .then((j: { hint?: string | null; source?: string }) => {
        if (cancelled || !j.hint || j.source === "none") return;
        setDefinition((prev) => (prev.trim() ? prev : j.hint!.trim()));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHintLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, seed, resetFromSeed]);

  const previewWord = useMemo((): WordWithProgress | null => {
    if (!seed) return null;
    const wordTags = tagIds
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is TagWithCount => Boolean(t))
      .map((t) => ({ id: t.id, name: t.name }));
    return normalizeWord({
      id: DRAFT_PLACEHOLDER_ID,
      word: lemma.trim() || seed.lemma.trim(),
      definition: definition.trim(),
      translation_zh: translationZh.trim(),
      ipa: ipa.trim(),
      part_of_speech: partOfSpeech.trim(),
      tags: wordTags,
      example_sentences: linesToArray(examplesText),
      unnatural_english: linesToArray(unnaturalEnglishText),
      synonyms: linesToArray(synonymsText),
      antonyms: linesToArray(antonymsText),
      collocations: linesToArray(collocationsText),
      pronunciation_url: null,
      rank: null,
      word_family: null,
      image_url: seed.image_url ?? null,
      image_prompt: seed.image_prompt ?? null,
      mnemonic: null,
      is_custom: true,
      created_at: new Date().toISOString(),
    });
  }, [
    seed,
    lemma,
    definition,
    translationZh,
    ipa,
    partOfSpeech,
    tagIds,
    tags,
    examplesText,
    unnaturalEnglishText,
    synonymsText,
    antonymsText,
    collocationsText,
  ]);

  const relationListDraftText = useMemo(
    () => ({
      synonyms: synonymsText,
      antonyms: antonymsText,
      collocations: collocationsText,
    }),
    [synonymsText, antonymsText, collocationsText]
  );

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
        case "unnatural_english":
          setUnnaturalEnglishText(value);
          break;
        case "tag_ids":
          setTagIds(value.split(",").filter(Boolean));
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
          snap.tag_ids = tagIds.join(",");
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
        case "back_unnatural_english":
          snap.unnatural_english = unnaturalEnglishText;
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
      tagIds,
      partOfSpeech,
      ipa,
      definition,
      translationZh,
      examplesText,
      unnaturalEnglishText,
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
    if (s.unnatural_english !== undefined) {
      setUnnaturalEnglishText(s.unnatural_english);
    }
    if (s.synonyms !== undefined) setSynonymsText(s.synonyms);
    if (s.antonyms !== undefined) setAntonymsText(s.antonyms);
    if (s.collocations !== undefined) setCollocationsText(s.collocations);
    if (s.tag_ids !== undefined) {
      setTagIds(s.tag_ids.split(",").filter(Boolean));
    }
    if (s.part_of_speech !== undefined) setPartOfSpeech(s.part_of_speech);
    if (s.ipa !== undefined) setIpa(s.ipa);
    sectionSnapRef.current = {};
    setEditingSection(null);
  }, []);

  const onSaveTextSection = useCallback(async (_sectionId: WordCardTextSectionId) => {
    setEditingSection(null);
  }, []);

  const sectionEdit = useMemo(
    () => ({
      editingSectionId: editingSection,
      sectionSaving: false,
      onStartSectionEdit,
      onCancelSectionEdit,
      onSaveTextSection,
      onSectionFieldChange,
    }),
    [
      editingSection,
      onStartSectionEdit,
      onCancelSectionEdit,
      onSaveTextSection,
      onSectionFieldChange,
    ]
  );

  const handleConfirm = async () => {
    const trimmedLemma = lemma.trim();
    if (!trimmedLemma) {
      toast.error("Word or expression cannot be empty");
      return;
    }
    if (editingSectionRef.current !== null) {
      toast.info("Save or cancel the section you're editing first.");
      return;
    }

    setConfirming(true);
    try {
      const wordRes = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: trimmedLemma,
          definition: definition.trim(),
          translation_zh: translationZh.trim(),
          ipa: ipa.trim(),
          part_of_speech: partOfSpeech.trim(),
          tag_ids: tagIds,
          example_sentences: linesToArray(examplesText),
          unnatural_english: linesToArray(unnaturalEnglishText),
          synonyms: linesToArray(synonymsText),
          antonyms: linesToArray(antonymsText),
          collocations: linesToArray(collocationsText),
          image_url: seed?.image_url ?? null,
          image_prompt: seed?.image_prompt ?? null,
        }),
      });

      if (!wordRes.ok) {
        const j = (await wordRes.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg = j.error ?? "";
        if (msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
          toast.error(
            `"${trimmedLemma}" is already in the dictionary. Search for it and tap Add.`
          );
        } else {
          toast.error(msg || "Failed to save word");
        }
        return;
      }

      const saved = (await wordRes.json()) as Word;
      const prog = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_id: saved.id }),
      });

      if (!prog.ok && prog.status !== 409) {
        const j = (await prog.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Word saved but could not add to My Words");
        return;
      }

      onConfirmed(saved);
      onOpenChange(false);
    } catch {
      toast.error("Failed to add word");
    } finally {
      setConfirming(false);
    }
  };

  const requestClose = (next: boolean) => {
    if (confirming) return;
    if (!next && editingSectionRef.current !== null) {
      toast.info("Save or cancel the section you're editing first.");
      return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        className="flex max-h-[min(96vh,920px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={!confirming}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <DialogTitle>Review before adding</DialogTitle>
          <DialogDescription>
            Flip the card and use the pencil icons to edit. Nothing is saved to
            My Words until you confirm below.
            {hintLoading ? " Loading dictionary hint…" : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {previewWord ? (
            <Flashcard
              key={`draft-${previewWord.word}`}
              word={previewWord}
              showAnswer={showAnswer}
              onFlip={() => setShowAnswer((s) => !s)}
              onRate={() => undefined}
              showRatingBar={false}
              sectionEdit={sectionEdit}
              relationListDraftText={relationListDraftText}
            />
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            disabled={confirming}
            onClick={() => requestClose(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={confirming}
            onClick={() => void handleConfirm()}
          >
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Adding…
              </>
            ) : (
              "Add to My Words"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
