import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  variant = "default",
  delay = 0,
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-14 px-6 relative overflow-hidden animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative background element */}


      {/* Icon */}
      {Icon && (
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ring-1 transition-all duration-200 ${
            variant === "success"
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/10"
              : variant === "danger"
                ? "bg-red-500/10 text-red-400 ring-red-500/10"
                : variant === "warning"
                  ? "bg-amber-500/10 text-amber-400 ring-amber-500/10"
                  : "bg-nexura-500/10 text-nexura-400 ring-nexura-500/10"
          }`}
        >
          <Icon className="w-6 h-6" />
        </div>
      )}

      {/* Default icon if none provided */}
      {!Icon && (
        <div className="w-14 h-14 rounded-2xl bg-nexura-500/10 text-nexura-400 flex items-center justify-center mb-4 ring-1 ring-nexura-500/10">
          <Inbox className="w-6 h-6" />
        </div>
      )}

      {/* Text */}
      <h3 className="font-display font-semibold text-white mb-1.5">{title}</h3>
      {message && <p className="text-sm text-slate/80 max-w-sm mb-5 leading-relaxed">{message}</p>}
      {action}
    </div>
  );
}
