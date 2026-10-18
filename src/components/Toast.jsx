import React, { useEffect } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useApp } from "../context/AppContext";

const STYLES = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  danger: {
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    iconColor: "text-red-400",
  },
  warning: {
    icon: Info,
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
  },
  info: {
    icon: Info,
    bg: "bg-nexura-500/10",
    border: "border-nexura-500/20",
    iconColor: "text-nexura-300",
  },
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-full max-w-sm">
      {toasts.map((t, index) => {
        const style = STYLES[t.type] || STYLES.success;
        const Icon = style.icon;
        const isWarning = t.type === "warning";
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl px-4 py-3.5 shadow-2xl shadow-black/30 border ${style.bg} ${style.border} bg-nexura-900/80 backdrop-blur-md animate-slide-up`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
            <p className={`text-sm font-medium flex-1 leading-snug ${isWarning ? "text-amber-300" : "text-white"}`}>
              {t.message}
            </p>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-white/40 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
