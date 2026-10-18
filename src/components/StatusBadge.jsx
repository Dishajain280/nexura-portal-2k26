import React from "react";
import { Clock, CheckCircle2, XCircle, Circle, AlertTriangle } from "lucide-react";

const CONFIG = {
  pending: { label: "Pending", classes: "bg-amber-500/12 text-amber-400 border-amber-500/30", Icon: Clock },
  approved: { label: "Approved", classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 },
  rejected: { label: "Changes needed", classes: "bg-red-500/12 text-red-400 border-red-500/30", Icon: XCircle },
  not_submitted: { label: "Not submitted", classes: "bg-white/8 text-nexura-200 border-white/12", Icon: Circle },
  overdue: { label: "Overdue", classes: "bg-red-500/15 text-red-400 border-red-500/30", Icon: AlertTriangle },
};

export default function StatusBadge({ status, size = "md" }) {
  const cfg = CONFIG[status] || CONFIG.not_submitted;
  const { label, classes, Icon } = cfg;
  const sizeClasses = size === "sm"
    ? "text-[11px] px-2 py-0.5 gap-1"
    : size === "lg"
      ? "text-sm px-3 py-1.5 gap-2"
      : "text-xs px-2.5 py-1 gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${classes} transition-all duration-150`}
      role="status"
      aria-label={label}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      {label}
    </span>
  );
}
