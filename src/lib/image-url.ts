const HTTP_URL_MAX = 2048;
/** Pasted screenshots stored as data URLs; keep under typical server body limits. */
const DATA_URL_MAX = 600_000;

const DATA_PREFIX_RE =
  /^data:image\/(png|jpeg|jpg|webp);base64,/i;

function isPlausibleBase64DataUrl(t: string): boolean {
  const m = t.match(DATA_PREFIX_RE);
  if (!m || m.index !== 0) return false;
  const payload = t.slice(m[0].length).replace(/\s/g, "");
  if (payload.length < 20) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(payload);
}

/** Validate user-supplied image URLs or pasted JPEG data URLs for storage (no server-side fetch). */
export function normalizeImageUrlForStorage(
  input: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined || input === "") {
    return { ok: true, value: null };
  }
  if (typeof input !== "string") {
    return { ok: false, error: "image_url must be a string" };
  }
  const t = input.trim().replace(/\s+/g, "");
  if (t.length === 0) return { ok: true, value: null };

  if (t.startsWith("data:image/")) {
    if (t.length > DATA_URL_MAX) {
      return {
        ok: false,
        error: `Pasted image is too large after compression (max ~${Math.round(DATA_URL_MAX / 1000)}k characters). Try cropping the screenshot.`,
      };
    }
    if (!isPlausibleBase64DataUrl(t)) {
      return {
        ok: false,
        error:
          "Only base64 data URLs for PNG, JPEG, or WebP images are allowed.",
      };
    }
    return { ok: true, value: t };
  }

  if (t.length > HTTP_URL_MAX) {
    return {
      ok: false,
      error: `image URL is too long (max ${HTTP_URL_MAX} characters). Paste a screenshot instead, or use a shorter link.`,
    };
  }
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return { ok: false, error: "image_url must be a valid URL or pasted image" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "image_url must start with http:// or https://" };
  }
  if (!u.hostname || u.hostname.length < 1) {
    return { ok: false, error: "image_url is missing a hostname" };
  }
  return { ok: true, value: t };
}
