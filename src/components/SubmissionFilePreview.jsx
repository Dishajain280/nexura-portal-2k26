import React, { useEffect, useState } from "react";
import { Image, File, FileText, ExternalLink, AlertCircle } from "lucide-react";
import supabase, { isSupabaseConfigured } from "../supabaseClient";
import { extractStoragePath, isStorageFileUrl } from "../lib/submissionFile";

/**
 * Inline preview of an uploaded submission file, used by both the student's
 * submission page and the coordinator's review page.
 *
 * The row stores either a Supabase storage URL (often an already-expired
 * signed URL) or a bare object path, so we can never just drop the stored
 * value into an <img>: instead we mint a fresh signed URL from the object
 * path and show the file right there —
 *
 *   - images (png/jpg/webp/gif/svg/...) render as an inline <img>,
 *   - PDFs render in an embedded viewer,
 *   - anything else (zip, docx, ...) falls back to a filename chip with an
 *     "Open file" action, since a browser cannot render those inline.
 *
 * Only http/https signed URLs and data:/blob: URLs are ever used as a media
 * source, and a failed preview always degrades to the chip rather than a
 * dead end.
 */

const BUCKET = "task-submissions";
const SIGNED_URL_TTL = 60 * 60; // 1h, matches openSubmissionFile()

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".bmp",
]);

const EMBED_EXTS = new Set([".pdf"]);

const IMAGE_DATA_URL_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const extOf = (value = "") => {
  const clean = String(value || "")
    .split(/[?#]/)[0]
    .toLowerCase();
  const base = clean.includes("/") ? clean.split("/").pop() : clean;
  return base.includes(".") ? "." + base.split(".").pop() : "";
};

const nameOf = (value = "") => {
  const clean = String(value || "").split(/[?#]/)[0];
  const base = clean.includes("/") ? clean.split("/").pop() : clean;
  return decodeURIComponent(base || "");
};

const kindFor = (ext) => {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (EMBED_EXTS.has(ext)) return "embed";
  return "file";
};

export default function SubmissionFilePreview({
  fileName,
  fileUrl,
  onOpen,
  storagePath,
  className,
}) {
  const [src, setSrc] = useState(null);
  const [kind, setKind] = useState("file");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const apply = (patch) => {
      if (cancelled) return;
      if ("src" in patch) setSrc(patch.src);
      if ("kind" in patch) setKind(patch.kind);
      if ("loading" in patch) setLoading(patch.loading);
      if ("error" in patch) setError(patch.error);
    };

    const storedName = fileName || nameOf(fileUrl);
    const ext = extOf(fileName || fileUrl);
    const extKind = kindFor(ext);
    const hasFile = Boolean(storedName || fileUrl || storagePath);

    if (!hasFile) {
      apply({ src: null, kind: "file", loading: false, error: false });
      return () => {
        cancelled = true;
      };
    }

    // 1. Local/data URLs (a file read in this session) — use them directly.
    if (fileUrl && /^(data|blob):/i.test(fileUrl)) {
      const isImage =
        extKind === "image" ||
        (fileUrl.startsWith("data:") &&
          IMAGE_DATA_URL_TYPES.has(
            fileUrl.split(",")[0]?.split(";")[0]?.split(":")[1] || "",
          ));
      const resolvedKind = isImage ? "image" : extKind;
      apply({
        src: resolvedKind === "file" ? null : fileUrl,
        kind: resolvedKind,
        loading: false,
        error: false,
      });
      return () => {
        cancelled = true;
      };
    }

    // 2. Non-previewable kinds never reach the network: a chip is the honest
    //    answer for zip/docx/... rather than a spinner that ends in nothing.
    if (extKind === "file") {
      apply({ src: null, kind: "file", loading: false, error: false });
      return () => {
        cancelled = true;
      };
    }

    // 3. Storage object: mint a fresh signed URL from the object path. The
    //    stored file_url is a signed URL too, but it expires (24h at upload),
    //    which is exactly why previews silently stopped working.
    const path =
      storagePath || (isStorageFileUrl(fileUrl || "") ? extractStoragePath(fileUrl) : "");

    if (path) {
      if (!isSupabaseConfigured) {
        apply({ src: null, kind: "file", loading: false, error: false });
        return () => {
          cancelled = true;
        };
      }

      apply({ src: null, kind: extKind, loading: true, error: false });
      supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL)
        .then(({ data, error: signError }) => {
          if (signError || !data?.signedUrl) {
            apply({ src: null, loading: false, error: true });
            return;
          }
          apply({ src: data.signedUrl, loading: false, error: false });
        })
        .catch(() => apply({ src: null, loading: false, error: true }));

      return () => {
        cancelled = true;
      };
    }

    // 4. Legacy rows stored an external link in file_url. Images can still be
    //    shown inline (a plain <img> needs no CORS); anything else opens on
    //    click through the existing safe-open handler.
    if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
      if (extKind === "image") {
        apply({ src: null, kind: "image", loading: true, error: false });
        const img = new Image();
        img.onload = () => apply({ src: fileUrl, loading: false, error: false });
        img.onerror = () => apply({ src: null, loading: false, error: true });
        img.src = fileUrl;
      } else {
        apply({ src: null, kind: "file", loading: false, error: false });
      }
      return () => {
        cancelled = true;
      };
    }

    apply({ src: null, kind: "file", loading: false, error: false });
    return () => {
      cancelled = true;
    };
  }, [fileName, fileUrl, storagePath]);

  const hasFile = Boolean(fileName || fileUrl || storagePath);
  const showPreview = Boolean(src) && !error && (kind === "image" || kind === "embed");
  const label = fileName || "File";

  if (!hasFile) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/[0.02] ${className || ""}`}>
        <div className="px-4 py-3 text-xs text-slate">No file attached</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden ${className || ""}`}>
        <div className="flex items-center justify-center gap-3 bg-[#05050a]/80 p-8 text-slate">
          <div className="w-6 h-6 border-2 border-nexura-400/40 border-t-nexura-300 rounded-full animate-spin" />
          <span className="text-sm">Loading preview…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden ${className || ""}`}>
      {showPreview && kind === "image" && (
        <img
          src={src}
          alt={label}
          className="w-full max-h-80 object-contain bg-[#05050a] p-2"
          loading="lazy"
          // A signed URL can still 403/404 (deleted object, revoked token):
          // fall back to the file chip instead of a broken-image icon.
          onError={() => setError(true)}
        />
      )}

      {showPreview && kind === "embed" && (
        <object
          data={src}
          type="application/pdf"
          aria-label={label}
          className="w-full h-96 bg-[#05050a]"
          onError={() => setError(true)}
        >
          <div className="flex items-center justify-center h-full px-4 text-center text-sm text-slate">
            This browser cannot display the PDF inline — use “Open file” below.
          </div>
        </object>
      )}

      {error && !showPreview && (
        <div className="flex items-center justify-center gap-3 bg-[#05050a]/80 p-6 text-slate">
          <AlertCircle className="w-6 h-6 shrink-0 text-amber-400/80" />
          <span className="text-sm">Preview unavailable — open the file instead.</span>
        </div>
      )}

      {!showPreview && !error && kind === "image" && (
        <div className="flex items-center justify-center gap-3 bg-[#05050a]/80 p-6 text-slate">
          <Image className="w-7 h-7 shrink-0" />
          <span className="text-sm">{label}</span>
        </div>
      )}

      {!showPreview && !error && kind === "embed" && (
        <div className="flex items-center justify-center gap-3 bg-[#05050a]/80 p-6 text-slate">
          <FileText className="w-7 h-7 shrink-0" />
          <span className="text-sm">{label}</span>
        </div>
      )}

      {!showPreview && kind === "file" && (
        <div className="flex items-center gap-2.5 px-4 py-3.5 text-sm">
          <File className="w-4 h-4 text-nexura-400 shrink-0" />
          <span className="text-nexura-100 truncate">{label}</span>
        </div>
      )}

      {showPreview && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {kind === "image" ? (
              <Image className="w-4 h-4 text-nexura-400 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-nexura-400 shrink-0" />
            )}
            <span className="text-nexura-100 truncate">{label}</span>
          </div>
          {onOpen && (
            <button
              type="button"
              onClick={() => onOpen()}
              className="shrink-0 text-nexura-300 hover:text-nexura-100 hover:underline flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {kind === "image" ? "Open image" : "Open file"}
            </button>
          )}
        </div>
      )}

      {error && onOpen && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <File className="w-4 h-4 text-nexura-400 shrink-0" />
            <span className="text-nexura-100 truncate">{label}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpen()}
            className="shrink-0 text-nexura-300 hover:text-nexura-100 hover:underline flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open file
          </button>
        </div>
      )}
    </div>
  );
}