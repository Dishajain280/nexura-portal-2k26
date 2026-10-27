import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}) {
  const modalRef = useRef(null);
  const previousActive = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousActive.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      // Trap focus within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Focus first focusable element after animation starts, but avoid stealing
    // focus from an element the user is actively typing into.
    const timer = setTimeout(() => {
      if (!modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const active = document.activeElement;
      const insideModal = modalRef.current.contains(active);
      if (!insideModal) {
        focusable[0].focus();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (previousActive.current instanceof HTMLElement) {
        previousActive.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-nexura-950/65 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal content */}
      <div
        ref={modalRef}
        className={`relative w-full ${sizes[size]} bg-nexura-900/95 backdrop-blur-xl rounded-xl2 shadow-2xl shadow-black/50 border border-white/10 max-h-[85vh] flex flex-col animate-fade-in-scale overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* Header accent */}
        <div className="h-1 w-full bg-cta-gradient shrink-0" />

        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          {title && (
            <h3
              id="modal-title"
              className="text-base font-display font-semibold text-white"
            >
              {title}
            </h3>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate hover:text-white hover:bg-white/8 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0 bg-white/[0.02]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
