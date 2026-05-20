/** Target max serialized length for PATCH JSON (base64 JPEG). */
const MAX_DATA_URL_CHARS = 480_000;

/**
 * Resize and re-encode a pasted image as JPEG so it fits in a JSON PATCH body
 * and displays reliably in <img src>.
 */
export async function compressImageFileToJpegDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Clipboard item is not an image");
  }

  let maxSide = 1280;

  for (let round = 0; round < 8; round++) {
    const bmp = await createImageBitmap(file);
    let w = bmp.width;
    let h = bmp.height;
    const scale = Math.min(1, maxSide / Math.max(w, h, 1));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      throw new Error("Canvas is not available");
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();

    let q = 0.82;
    for (let qStep = 0; qStep < 10; qStep++) {
      const dataUrl = canvas.toDataURL("image/jpeg", q);
      if (dataUrl.length <= MAX_DATA_URL_CHARS) {
        return dataUrl;
      }
      q -= 0.07;
    }

    maxSide = Math.round(maxSide * 0.72);
    if (maxSide < 280) {
      const last = canvas.toDataURL("image/jpeg", 0.42);
      if (last.length <= MAX_DATA_URL_CHARS * 1.05) return last;
      throw new Error("Image is still too large after compression; try a smaller screenshot.");
    }
  }

  throw new Error("Could not compress image enough");
}

export async function imageFromClipboardEvent(
  e: ClipboardEvent
): Promise<File | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}
