"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { WordSectionEditForm } from "@/components/word-section-edit-form";
import {
  parseWordEditSectionSlug,
  wordEditSectionLabel,
} from "@/lib/word-section-meta";
import {
  buildSectionPatchPayload,
  sectionFieldsFromWord,
  type SectionFieldValues,
} from "@/lib/word-section-save";
import type { WordWithProgress } from "@/lib/types";
import { normalizeWord } from "@/lib/word-utils";

function EditPageFooter({
  wordId,
  saving,
  onSave,
}: {
  wordId: string;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <footer className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:relative">
      <div className="mx-auto flex w-full max-w-3xl gap-2">
        <Link
          href={`/words/${wordId}?tab=back`}
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
          onClick={onSave}
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
  );
}

function WordSectionEditInner() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const sectionParam =
    typeof params?.section === "string" ? params.section : "";
  const sectionId = parseWordEditSectionSlug(sectionParam);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [word, setWord] = useState<WordWithProgress | null>(null);
  const [values, setValues] = useState<SectionFieldValues | null>(null);

  const loadWord = useCallback(async () => {
    if (!id || !sectionId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/words/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        setWord(null);
        setValues(null);
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
      setWord(merged);
      setValues(sectionFieldsFromWord(merged));
    } catch {
      toast.error("Could not load word");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, sectionId]);

  useEffect(() => {
    void loadWord();
  }, [loadWord]);

  /* Lock document scroll on mobile so Save/Cancel stay pinned to the viewport. */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingBottom;
    document.body.style.overflow = "hidden";
    document.body.style.paddingBottom = "0";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingBottom = prevPadding;
    };
  }, []);

  const onChange = useCallback((patch: Partial<SectionFieldValues>) => {
    setValues((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleSave = async () => {
    if (!word || !values || !sectionId) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(sectionId, word, values);
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
      if (sectionId === "back_header") {
        const tagRes = await fetch(`/api/words/${word.id}/tags`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag_ids: values.tagIds }),
        });
        if (!tagRes.ok) {
          const err = await tagRes.json().catch(() => ({}));
          toast.error(
            typeof err?.error === "string" ? err.error : "Could not save tags"
          );
          return;
        }
      }
      toast.success("Saved");
      router.push(`/words/${word.id}?tab=back`);
      router.refresh();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!id || !sectionId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">
          Invalid link.
        </div>
      </AppShell>
    );
  }

  const sectionLabel = wordEditSectionLabel(sectionId);
  const showEditor = !loading && word && values;

  return (
    <AppShell>
      <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-background md:static md:z-auto md:h-dvh md:max-h-dvh md:min-h-0">
        <header className="shrink-0 border-b bg-background px-4 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={`/words/${id}?tab=back`} className="shrink-0">
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
              {sectionLabel}
            </h1>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-3">
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
            <WordSectionEditForm
              sectionId={sectionId}
              word={word}
              values={values}
              onChange={onChange}
              layout="fullscreen"
            />
          )}
        </div>

        {showEditor && (
          <EditPageFooter
            wordId={id}
            saving={saving}
            onSave={() => void handleSave()}
          />
        )}
      </div>
    </AppShell>
  );
}

export default function WordSectionEditPage() {
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
      <WordSectionEditInner />
    </Suspense>
  );
}
