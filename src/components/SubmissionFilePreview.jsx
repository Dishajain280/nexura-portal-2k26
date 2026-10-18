import React, { useEffect, useState } from "react";
import { Image, File, ExternalLink } from "lucide-react";

/**
 * Renders an inline preview of an uploaded submission file when we can
 * safely display it inside the portal, otherwise falls back to the file
 * name chip + download/open action.
 *
 * This deliberately does two things:
 *   1. For images (png/jpg/webp/gif/svg) it can show an inline <img />
 *      from a storage URL or a base64 blob, so the coordinator can review
 *      screenshots and uploads without leaving the page.
 *   2. For everything else it still shows the filename and an action button.
 *
 * It never trusts a URL for inline display without a sanity check: only
 * http/https URLs and blob URLs are used as <img src>. External links that
 * were historically stored in file_url (e.g. a GitHub link) are treated as
 * non-previewable.
 */
const ALLOWED_INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const INLINE_BY_EXTENSION = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

export default function SubmissionFilePreview({
  fileName,
  fileUrl,
  onOpen,
  storagePath,
  storageFrom,
  className,
}) {
  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const decide = () => {
      // No file at all -> nothing to preview.
      if (!fileName && !fileUrl && !storagePath) {
        setPreviewSrc(null);
        return;
      }

      const name = String(fileName || "").trim();
      const ext = name.includes(".")
        ? "." + name.split(".").pop().toLowerCase()
        : "";

      // 1. Base64 / data URL already given.
      if (fileUrl && /^data:/i.test(fileUrl)) {
        if (ALLOWED_INLINE_TYPES.has(fileUrl.split(",")[0]?.split(";")[0]?.split(":")[1] || "")) {
          if (active) setPreviewSrc(fileUrl);
        } else {
          if (active) setPreviewSrc(null);
        }
        return;
      }

      // 2. Blob URL already given (e.g. from a local file read).
      if (fileUrl && /^blob:/i.test(fileUrl)) {
        if (active) setPreviewSrc(fileUrl);
        return;
      }

      // 3. Storage object path or signed URL from Supabase.
      //    We only inline-display images. For a signed URL we rely on its
      //    content-type later; for a bare path we infer from the extension.
      if (storagePath || (fileUrl && /^\/\/|https?:\/\//i.test(fileUrl))) {
        const source =
          storagePath || (fileUrl && /^\/\/|https?:\/\//i.test(fileUrl)) ? fileUrl : null;
        if (!source) {
          if (active) setPreviewSrc(null);
          return;
        }

        // Extension-based fast path: if the name says image, try it.
        if (INLINE_BY_EXTENSION.has(ext)) {
          if (active) {
            setPreviewLoading(true);
            objectUrl = URL.createObjectURL(new Blob()); // placeholder, replaced below
            // We cannot fetch cross-origin file bytes from a storage path
            // without a signed URL, so for a bare path we only show the
            // image icon chip rather than an <img> that would 403.
            setPreviewSrc(null);
            setPreviewLoading(false);
          }
          return;
        }

        // Signed URL with explicit image content-type? Try it. We do not
        // fetch the bytes here; we let the browser request the image.
        if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
          if (active) {
            setPreviewLoading(true);
            const img = new Image();
            img.onload = () => {
              if (active) {
                setPreviewLoading(false);
                setPreviewSrc(fileUrl);
              }
            };
            img.onerror = () => {
              if (active) {
                setPreviewLoading(false);
                setPreviewError(true);
              }
            };
            img.src = fileUrl;
          }
          return;
        }
      }

      // 4. Not previewable inline -> fall back to the chip.
      if (active) setPreviewSrc(null);
    };

    decide();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName, fileUrl, storagePath]);

  const hasFile = Boolean(fileName || fileUrl || storagePath);
  const isImage =
    INLINE_BY_EXTENSION.has(
      (fileName || "").includes(".") ? "." + (fileName || "").split(".").pop().toLowerCase() : "",
    ) || previewSrc != null;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden ${
        className || ""
      }`}
    >
      {previewSrc && !previewError && (
        <div className="relative">
          <img
            src={previewSrc}
            alt={fileName || "Submission preview"}
            className="max-w-full max-h-80 object-contain bg-[#05050a] p-2"
            loading="lazy"
          />
          {previewLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#05050a]/80">
              <div className="w-7 h-7 border-2 border-nexura-400/40 border-t-nexura-300 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {!previewSrc && isImage && !previewError && hasFile && (
        <div className="flex items-center justify-center bg-[#05050a]/80 p-6 text-slate">
          <Image className="w-7 h-7 shrink-0" />
          <span className="ml-3 text-sm">{fileName || "Image upload"}</span>
        </div>
      )}

      {previewError && (
        <div className="flex items-center justify-center bg-[#05050a]/80 p-6 text-slate">
          <File className="w-7 h-7 shrink-0" />
          <span className="ml-3 text-sm">Could not load preview</span>
        </div>
      )}

      {!isImage && hasFile && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <File className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-nexura-100 truncate">{fileName || "File"}</span>
          </div>
          {onOpen && (
            <button
              type="button"
              onClick={() => onOpen()}
              className="shrink-0 text-nexura-300 hover:text-nexura-100 hover:underline flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {isImage ? "Open image" : "Open file"}
            </button>
          )}
        </div>
      )}

      {!hasFile && <div className="px-4 py-3 text-xs text-slate">No file attached</div>}
    </div>
  );
}

