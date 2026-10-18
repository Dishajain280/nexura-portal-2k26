/**
 * Helpers for uploaded submission files.
 *
 * We store the storage URL (or bare object path) on the submission row, but a
 * signed URL expires after an hour. The embedded object path never expires, so
 * the UI can always mint a fresh signed URL from it on click instead of
 * linking a URL that is already dead.
 */

const STORAGE_MARKER = "/storage/v1/object/";
const DEFAULT_BUCKET = "task-submissions";

/** True when the value points at a Supabase storage object. */
export const isStorageFileUrl = (value = "") =>
  typeof value === "string" && value.includes(STORAGE_MARKER);

/**
 * Extract the object path (without the bucket) from a storage URL, or pass a
 * bare path through unchanged. Returns "" for external URLs such as a
 * GitHub link that older rows stored in `file_url`.
 */
export const extractStoragePath = (input = "", bucket = DEFAULT_BUCKET) => {
  const value = String(input || "").trim();
  if (!value) return "";

  if (!value.includes(STORAGE_MARKER)) {
    // Bare object path (no host) or an unrelated external URL.
    return /^https?:\/\//i.test(value) ? "" : value.replace(/^\/+/, "");
  }

  try {
    const url = new URL(value);
    const index = url.pathname.indexOf(STORAGE_MARKER);
    if (index < 0) return "";
    let path = url.pathname.slice(index + STORAGE_MARKER.length);
    path = path.replace(/^sign\//, ""); // signed-URL form: /object/sign/<path>
    if (path.startsWith(`${bucket}/`)) path = path.slice(bucket.length + 1);
    return decodeURIComponent(path);
  } catch {
    return "";
  }
};
