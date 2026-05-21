"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeImageUrlForStorage } from "@/lib/image-url";
import {
  compressImageFileToJpegDataUrl,
  imageFromClipboardEvent,
} from "@/lib/image-paste";

export type WordImageUrlFormHandle = {
  /** Saves staged image (defer mode) or no-ops when not in defer mode. */
  commit: () => Promise<boolean>;
};

type WordImageUrlFormProps = {
  wordId: string;
  imageUrl: string | null;
  /** Called after a successful PATCH so parents can merge `image_url`. */
  onSaved: (nextUrl: string | null) => void;
  compact?: boolean;
  /**
   * When true, paste/drop/clear stage locally; `commit()` PATCHes (Save applies URL).
   */
  deferSave?: boolean;
  /** Full-page editor: no outer border, larger type. */
  fullPage?: boolean;
};

function syncFieldsFromImageUrl(
  imageUrl: string | null,
  deferSave: boolean
): { value: string; staged: string } {
  const iu = imageUrl ?? "";
  if (deferSave) {
    return {
      staged: iu,
      value: iu.startsWith("http") ? iu : "",
    };
  }
  return { staged: iu, value: iu };
}

export const WordImageUrlForm = forwardRef<
  WordImageUrlFormHandle,
  WordImageUrlFormProps
>(function WordImageUrlForm(
  { wordId, imageUrl, onSaved, compact, deferSave = false, fullPage = false },
  ref
) {
  const large = fullPage || (!compact && deferSave);
  const [value, setValue] = useState(() => syncFieldsFromImageUrl(imageUrl, deferSave).value);
  const [stagedImageUrl, setStagedImageUrl] = useState(
    () => syncFieldsFromImageUrl(imageUrl, deferSave).staged
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deferSave) return;
    const next = syncFieldsFromImageUrl(imageUrl, true);
    setValue(next.value);
    setStagedImageUrl(next.staged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed staging only when switching cards, not when `image_url` updates during an open edit dialog
  }, [wordId, deferSave]);

  useEffect(() => {
    if (deferSave) return;
    const next = syncFieldsFromImageUrl(imageUrl, false);
    setValue(next.value);
    setStagedImageUrl(next.staged);
  }, [wordId, imageUrl, deferSave]);

  const patchImageUrl = useCallback(
    async (body: { image_url: string | null }) => {
      const res = await fetch(`/api/words/${wordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        image_url?: string | null;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not update image");
        return false;
      }
      const next =
        json.image_url === undefined || json.image_url === null
          ? null
          : String(json.image_url);
      onSaved(next);
      toast.success(next ? "Card image updated" : "Custom image cleared");
      return true;
    },
    [wordId, onSaved]
  );

  const resolvePayloadUrl = useCallback((): {
    ok: true;
    value: string;
  } | {
    ok: false;
    error: string;
  } => {
    const urlInput = value.trim();
    const base = urlInput || stagedImageUrl;
    const normalized = normalizeImageUrlForStorage(base);
    if (!normalized.ok) {
      return { ok: false, error: normalized.error };
    }
    return { ok: true, value: normalized.value ?? "" };
  }, [value, stagedImageUrl]);

  const commit = useCallback(async (): Promise<boolean> => {
    if (!deferSave) return false;
    const resolved = resolvePayloadUrl();
    if (!resolved.ok) {
      toast.error(resolved.error);
      return false;
    }
    if (!resolved.value && !value.trim() && !stagedImageUrl.trim()) {
      toast.info("Paste an image, enter a URL, or use Clear.");
      return false;
    }
    setSaving(true);
    try {
      const ok = await patchImageUrl({ image_url: resolved.value || null });
      if (ok) {
        const iu = resolved.value ?? "";
        setStagedImageUrl(iu);
        setValue(iu.startsWith("http") ? iu : "");
      }
      return ok;
    } finally {
      setSaving(false);
    }
  }, [deferSave, resolvePayloadUrl, value, stagedImageUrl, patchImageUrl]);

  useImperativeHandle(ref, () => ({ commit }), [commit]);

  const saveDataUrl = useCallback(
    async (dataUrl: string) => {
      const normalized = normalizeImageUrlForStorage(dataUrl);
      if (!normalized.ok) {
        toast.error(normalized.error);
        return;
      }
      setSaving(true);
      try {
        await patchImageUrl({ image_url: normalized.value });
      } finally {
        setSaving(false);
      }
    },
    [patchImageUrl]
  );

  const handleApplyUrl = useCallback(async () => {
    const t = value.trim();
    if (!t) {
      toast.info(
        "Enter an image URL, paste a screenshot in the box below, or use Clear."
      );
      return;
    }
    const normalized = normalizeImageUrlForStorage(value);
    if (!normalized.ok) {
      toast.error(normalized.error);
      return;
    }

    if (deferSave) {
      setStagedImageUrl(normalized.value ?? "");
      return;
    }

    setSaving(true);
    try {
      await patchImageUrl({ image_url: normalized.value });
    } finally {
      setSaving(false);
    }
  }, [value, patchImageUrl, deferSave]);

  const handleClear = useCallback(async () => {
    if (deferSave) {
      setStagedImageUrl("");
      setValue("");
      return;
    }
    setSaving(true);
    try {
      const ok = await patchImageUrl({ image_url: null });
      if (ok) setValue("");
    } finally {
      setSaving(false);
    }
  }, [deferSave, patchImageUrl]);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const file = await imageFromClipboardEvent(e.nativeEvent);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      setSaving(true);
      try {
        const dataUrl = await compressImageFileToJpegDataUrl(file);
        if (deferSave) {
          const normalized = normalizeImageUrlForStorage(dataUrl);
          if (!normalized.ok) {
            toast.error(normalized.error);
            return;
          }
          setStagedImageUrl(normalized.value ?? "");
          setValue("");
          return;
        }
        await saveDataUrl(dataUrl);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not use pasted image"
        );
      } finally {
        setSaving(false);
      }
    },
    [saveDataUrl, deferSave]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.info("Drop a PNG, JPEG, or WebP file.");
        return;
      }
      setSaving(true);
      try {
        const dataUrl = await compressImageFileToJpegDataUrl(file);
        if (deferSave) {
          const normalized = normalizeImageUrlForStorage(dataUrl);
          if (!normalized.ok) {
            toast.error(normalized.error);
            return;
          }
          setStagedImageUrl(normalized.value ?? "");
          setValue("");
          return;
        }
        await saveDataUrl(dataUrl);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not use dropped image"
        );
      } finally {
        setSaving(false);
      }
    },
    [saveDataUrl, deferSave]
  );

  const clearDisabled =
    saving ||
    (deferSave
      ? !stagedImageUrl?.trim() && !value.trim()
      : !imageUrl?.trim());

  const previewSrc = deferSave
    ? stagedImageUrl.trim() ||
      (value.trim().startsWith("http") ? value.trim() : "")
    : "";

  return (
    <div
      className={cn(
        "space-y-3 font-sans",
        fullPage ? "w-full space-y-5" : "rounded-lg border bg-muted/20 p-3",
        compact && !fullPage && "p-2.5 space-y-2.5"
      )}
    >
      {!fullPage ? (
        <p
          className={cn(
            "font-medium text-muted-foreground uppercase tracking-wider",
            compact ? "text-xs" : "text-sm"
          )}
        >
          Card image
        </p>
      ) : null}

      {deferSave && previewSrc ? (
        <div
          className={cn(
            "overflow-hidden aspect-[16/9] flex items-center justify-center bg-muted/30",
            fullPage ? "max-h-56 rounded-lg" : "rounded-lg border max-h-40",
            compact && !fullPage && "max-h-36"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="" className="w-full h-full object-cover" />
        </div>
      ) : null}

      <div
        tabIndex={0}
        role="region"
        aria-label="Paste or drop a screenshot"
        onPaste={(e) => void handlePaste(e)}
        onDrop={(e) => void handleDrop(e)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "rounded-md border border-dashed border-muted-foreground/35 bg-muted/20 px-3 py-4 text-center outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          saving && "pointer-events-none opacity-60",
          large ? "py-8" : compact ? "py-3" : "py-5"
        )}
      >
        <ImagePlus
          className={cn(
            "mx-auto text-muted-foreground/60 mb-2",
            large ? "size-12" : compact ? "size-8" : "size-10"
          )}
          aria-hidden
        />
        <p
          className={cn(
            "font-medium text-foreground",
            large ? "text-base" : compact ? "text-xs" : "text-sm"
          )}
        >
          Paste a screenshot here
        </p>
        <p
          className={cn(
            "text-muted-foreground mt-2 leading-relaxed",
            large ? "text-sm" : compact ? "text-[11px]" : "text-xs"
          )}
        >
          Click this box, then{" "}
          <kbd
            className={cn(
              "rounded border bg-muted px-1.5 py-0.5 font-mono",
              large ? "text-xs" : "text-[10px]"
            )}
          >
            Ctrl+V
          </kbd>{" "}
          /{" "}
          <kbd
            className={cn(
              "rounded border bg-muted px-1.5 py-0.5 font-mono",
              large ? "text-xs" : "text-[10px]"
            )}
          >
            ⌘V
          </kbd>
          . You can also drag an image file here.
        </p>
      </div>

      <div className="space-y-2">
        <p
          className={cn(
            "text-muted-foreground leading-snug",
            large ? "text-sm" : compact ? "text-[11px]" : "text-xs"
          )}
        >
          {deferSave
            ? "Optional image link — applied when you tap Save"
            : "Optional: image link (short https URL)"}
        </p>
        <Input
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
          className={cn(
            "font-sans w-full",
            large ? "h-11 text-base" : compact ? "text-sm h-10" : "text-sm h-10"
          )}
          autoComplete="off"
        />
        <div className="flex gap-2">
          {!deferSave ? (
            <Button
              type="button"
              size={compact ? "sm" : "default"}
              disabled={saving}
              onClick={() => void handleApplyUrl()}
            >
              Apply URL
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size={large ? "default" : compact ? "sm" : "default"}
            className={cn(deferSave && "min-w-[5.5rem]")}
            disabled={clearDisabled}
            onClick={() => void handleClear()}
          >
            Clear
          </Button>
        </div>
      </div>
      {deferSave && !fullPage ? (
        <p className="text-xs text-muted-foreground">
          Tap <span className="font-medium text-foreground">Save</span> below to keep
          changes, or <span className="font-medium text-foreground">Cancel</span> to
          discard.
        </p>
      ) : null}
    </div>
  );
});
