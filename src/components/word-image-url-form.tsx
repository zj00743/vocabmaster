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
   * When true, paste/drop/apply/clear only update local staging; call `commit()`
   * via ref to PATCH. Used inside “edit image” modals.
   */
  deferSave?: boolean;
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
  { wordId, imageUrl, onSaved, compact, deferSave = false },
  ref
) {
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

  const commit = useCallback(async (): Promise<boolean> => {
    if (!deferSave) return false;
    const normalized = normalizeImageUrlForStorage(stagedImageUrl);
    if (!normalized.ok) {
      toast.error(normalized.error);
      return false;
    }
    setSaving(true);
    try {
      const ok = await patchImageUrl({ image_url: normalized.value });
      if (ok) {
        const iu = normalized.value ?? "";
        setStagedImageUrl(iu);
        setValue(iu.startsWith("http") ? iu : "");
      }
      return ok;
    } finally {
      setSaving(false);
    }
  }, [deferSave, stagedImageUrl, patchImageUrl]);

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

  const previewSrc = deferSave ? stagedImageUrl.trim() : "";

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 p-3 space-y-3",
        compact && "p-2.5 space-y-2.5"
      )}
    >
      <p
        className={cn(
          "font-medium text-muted-foreground uppercase tracking-wider",
          compact ? "text-xs" : "text-sm"
        )}
      >
        Card image
      </p>

      {deferSave && previewSrc ? (
        <div
          className={cn(
            "rounded-lg border bg-muted/30 overflow-hidden aspect-[16/9] flex items-center justify-center max-h-40",
            compact && "max-h-36"
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
          "rounded-md border border-dashed border-muted-foreground/35 bg-background/80 px-3 py-4 text-center outline-none transition-colors",
          "hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          saving && "pointer-events-none opacity-60",
          compact ? "py-3" : "py-5"
        )}
      >
        <ImagePlus
          className={cn(
            "mx-auto text-muted-foreground/60 mb-2",
            compact ? "size-8" : "size-10"
          )}
          aria-hidden
        />
        <p
          className={cn(
            "font-medium text-foreground",
            compact ? "text-xs" : "text-sm"
          )}
        >
          Paste a screenshot here
        </p>
        <p
          className={cn(
            "text-muted-foreground mt-1",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          Click this box, then{" "}
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Ctrl+V
          </kbd>{" "}
          /{" "}
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⌘V
          </kbd>
          . You can also drag an image file onto this area. No long URL needed.
        </p>
      </div>

      <div className="space-y-1.5">
        <p
          className={cn(
            "text-muted-foreground",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          Optional: image link (paste in the field only if you have a short https
          URL)
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            className={cn("font-sans", compact ? "text-sm h-10" : "text-sm")}
            autoComplete="off"
          />
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              size={compact ? "sm" : "default"}
              disabled={saving}
              onClick={() => void handleApplyUrl()}
            >
              Apply URL
            </Button>
            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              disabled={clearDisabled}
              onClick={() => void handleClear()}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
      {deferSave ? (
        <p className="text-[11px] text-muted-foreground">
          Tap <span className="font-medium text-foreground">Save</span> below to keep
          changes, or <span className="font-medium text-foreground">Cancel</span> to
          discard.
        </p>
      ) : null}
    </div>
  );
});
