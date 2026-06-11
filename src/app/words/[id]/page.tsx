"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flashcard } from "@/components/flashcard";
import { FsrsForgettingCurvePanel } from "@/components/fsrs-forgetting-curve";
import type { WordWithProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";

type EditorTab = "front" | "back" | "memory-curve";

function tabFromSearchParams(raw: string | null): EditorTab {
  if (raw === "back" || raw === "memory-curve") return raw;
  return "front";
}

function WordEditorInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>(() =>
    tabFromSearchParams(searchParams.get("tab"))
  );
  const [word, setWord] = useState<WordWithProgress | null>(null);

  const loadWord = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/words/${id}`, { cache: "no-store" });
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
      setWord(
        normalizeWord({
          ...data,
          progress,
        } as WordWithProgress)
      );
    } catch {
      toast.error("Could not load word");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setEditorTab(tabFromSearchParams(searchParams.get("tab")));
    void loadWord();
  }, [searchParams, loadWord]);

  const mergeImage = useCallback((nextUrl: string | null) => {
    setWord((prev) => (prev ? { ...prev, image_url: nextUrl } : null));
  }, []);

  const browseEdit = id ? { wordId: id } : undefined;

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
        Invalid link.
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden md:h-full md:max-h-none md:flex-1">
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col overflow-hidden md:max-w-none md:px-8">
        <header className="shrink-0 border-b bg-background px-4 pb-3 pt-4 md:px-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/words" className="shrink-0 md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 font-sans"
                aria-label="Back to My Words"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            {word && (
              <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
                {word.word}
              </h1>
            )}
            <Link href="/words" className="hidden md:inline-flex shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="font-sans"
                aria-label="Close card panel"
              >
                <X className="size-4" />
              </Button>
            </Link>
          </div>
        </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
            {!loading && word && (
              <div className="bg-background px-4 py-3 md:px-0">
                <Tabs
                  value={editorTab}
                  onValueChange={(v) => setEditorTab(v as EditorTab)}
                  className="w-full gap-0"
                >
                  <TabsList className="grid h-10 w-full grid-cols-3">
                    <TabsTrigger value="front" className="font-sans text-sm">
                      Front
                    </TabsTrigger>
                    <TabsTrigger value="back" className="font-sans text-sm">
                      Back
                    </TabsTrigger>
                    <TabsTrigger
                      value="memory-curve"
                      className="font-sans text-sm"
                    >
                      Memory curve
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {loading && (
              <div className="px-4 py-24 text-center text-muted-foreground animate-pulse md:px-0">
                Loading card…
              </div>
            )}

            {!loading && notFound && (
              <div className="mx-4 my-8 rounded-xl border bg-muted/30 px-6 py-12 text-center space-y-3 md:mx-0">
                <p className="text-muted-foreground">Word not found.</p>
                <Link href="/words">
                  <Button variant="outline">Back to My Words</Button>
                </Link>
              </div>
            )}

            {!loading && word && (
              <>
                {editorTab === "front" && (
                  <Flashcard
                    key={`${word.id}-front`}
                    word={word}
                    showAnswer={false}
                    onFlip={() => undefined}
                    onRate={() => undefined}
                    onWordImageUpdate={(wid, url) => {
                      if (wid !== word.id) return;
                      mergeImage(url);
                    }}
                    showRatingBar={false}
                    layout="page"
                    pageSide="front"
                    browseEdit={browseEdit}
                  />
                )}

                {editorTab === "back" && (
                  <Flashcard
                    key={`${word.id}-back`}
                    word={word}
                    showAnswer
                    onFlip={() => undefined}
                    onRate={() => undefined}
                    onWordImageUpdate={(wid, url) => {
                      if (wid !== word.id) return;
                      mergeImage(url);
                    }}
                    showRatingBar={false}
                    layout="page"
                    pageSide="back"
                    browseEdit={browseEdit}
                  />
                )}

                {editorTab === "memory-curve" &&
                  (word.progress ? (
                    <FsrsForgettingCurvePanel progress={word.progress} />
                  ) : (
                    <p className="px-4 py-12 text-center text-sm text-muted-foreground font-sans leading-relaxed sm:px-6">
                      No review history yet. Rate this word in Review to build a
                      memory curve.
                    </p>
                  ))}
              </>
            )}
          </div>
        </div>
    </div>
  );
}

export default function WordDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WordEditorInner />
    </Suspense>
  );
}
