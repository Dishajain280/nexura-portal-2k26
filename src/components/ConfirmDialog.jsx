import React from "react";
import Modal from "./Modal";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  danger = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      // The footer is what makes this a confirmation rather than an
      // information box: without these two buttons every destructive action in
      // the portal (approve, reject, remove submission, delete task) could only
      // ever be cancelled, and the flow dead-ended at an X.
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={() => {
              onConfirm?.();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150 ${
            danger
              ? "bg-red-500/12 text-red-400 ring-1 ring-red-500/20"
              : "bg-nexura-500/15 text-nexura-300 ring-1 ring-nexura-500/10"
          }`}
        >
          {danger ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate/90 leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  );
}
