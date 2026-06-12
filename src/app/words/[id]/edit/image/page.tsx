"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  WordImageUrlForm,
  type WordImageUrlFormHandle,
} from "@/components/word-image-url-form";
import type { WordWithProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";

function WordImageEditInner() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const returnHref = `/words/${id}?tab=front`;

  const formRef = useRef<WordImageUrlFormHandle>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [word, setWord] = useState<WordWithProgress | null>(null);

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
    void loadWord();
  }, [loadWord]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingBottom;
    document.body.style.overflow = "hidden";
    document.body.style.paddingBottom = "0";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingBottom = prevPadding;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await formRef.current?.commit();
      if (ok) {
        router.push(returnHref);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
        Invalid link.
      </div>
    );
  }

  const showEditor = !loading && word;

  return (
    <div className="fixed inset-0 z-30 flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background md:static md:z-auto md:h-full md:max-h-none md:flex-1">
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col overflow-hidden md:max-w-none md:px-8">
        <header className="shrink-0 border-b bg-background px-4 pb-3 pt-4 md:px-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={returnHref} className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 font-sans"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
              Card image
            </h1>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
          {loading && (
            <p className="text-center text-muted-foreground animate-pulse py-16">
              Loading…
            </p>
          )}

          {!loading && notFound && (
            <div className="space-y-3 py-12 text-center">
              <p className="text-muted-foreground">Word not found.</p>
              <Link href="/words">
                <Button variant="outline">My Words</Button>
              </Link>
            </div>
          )}

          {showEditor && (
            <div className="mx-auto w-full max-w-3xl">
              <WordImageUrlForm
                ref={formRef}
                key={word.id}
                wordId={word.id}
                imageUrl={word.image_url}
                onSaved={(url) => {
                  setWord((prev) =>
                    prev ? { ...prev, image_url: url } : null
                  );
                }}
                deferSave
                fullPage
              />
            </div>
          )}
        </div>

        {showEditor && (
          <footer className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:relative">
            <div className="mx-auto flex w-full max-w-3xl gap-2">
              <Link
                href={returnHref}
                className="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium font-sans shadow-xs hover:bg-muted/60"
                aria-disabled={saving}
                tabIndex={saving ? -1 : undefined}
                onClick={(e) => {
                  if (saving) e.preventDefault();
                }}
              >
                Cancel
              </Link>
              <Button
                type="button"
                className="h-10 flex-1 font-sans bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default function WordImageEditPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WordImageEditInner />
    </Suspense>
  );
}
