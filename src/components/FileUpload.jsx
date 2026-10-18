import React, { useRef, useState } from "react";
import { UploadCloud, File, X, FileText } from "lucide-react";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export default function FileUpload({ file, onFileSelect, accept, hint = "ZIP, PDF, or image files up to 25MB" }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFiles = (fileList) => {
    setSizeError("");
    if (fileList && fileList[0]) {
      const selected = fileList[0];
      if (selected.size > MAX_FILE_SIZE) {
        const sizeMB = (selected.size / (1024 * 1024)).toFixed(1);
        setSizeError(`File is ${sizeMB}MB — maximum allowed is 25MB.`);
        return;
      }
      onFileSelect(selected);
    }
  };

  const getFileIcon = () => {
    if (!file) return UploadCloud;
    const name = typeof file === "string" ? file : file.name;
    const ext = name.split(".").pop()?.toLowerCase();
    if (["pdf"].includes(ext)) return FileText;
    return File;
  };

  const FileIcon = getFileIcon();

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-nexura-400 bg-nexura-500/8 ring-2 ring-nexura-400/20 scale-[1.01]"
            : dragActive
              ? "border-nexura-400 bg-white/[0.05]"
              : "border-white/15 hover:border-nexura-300 hover:bg-white/[0.03]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {file ? (
          <div className="flex items-center justify-between bg-white/[0.06] rounded-lg border border-white/10 px-4 py-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-nexura-500/12 text-nexura-300 flex items-center justify-center shrink-0">
                <FileIcon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{typeof file === "string" ? file : file.name}</p>
                <p className="text-xs text-slate">
                  {typeof file === "string" ? "Uploaded" : formatSize(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
              className="text-slate hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-nexura-500/12 text-nexura-400 flex items-center justify-center mx-auto mb-3 transition-colors duration-200 group-hover:bg-nexura-500/18 group-hover:text-nexura-300">
              <FileIcon className="w-5.5 h-5.5" />
            </div>
            <p className="text-sm font-medium text-nexura-100">
              <span className="text-nexura-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate mt-1.5">{hint}</p>
          </>
        )}
      </div>
      {sizeError && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5 shrink-0" />
          {sizeError}
        </p>
      )}
    </div>
  );
}
