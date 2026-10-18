import React from "react";

export default function ProgressBar({
  value,
  max = 100,
  showLabel = true,
  className = "",
  variant = "gradient",
  size = "md",
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const barHeight = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  const labelSize = size === "sm" ? "text-[11px]" : "text-xs";

  const barGradient = variant === "gradient"
    ? "bg-gradient-to-r from-nexura-500 to-accent-fuchsia"
    : variant === "solid"
      ? "bg-nexura-500"
      : variant === "emerald"
        ? "bg-emerald-500"
        : "bg-gradient-to-r from-nexura-500 to-accent-fuchsia";

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-medium text-nexura-200 ${labelSize}`}>Progress</span>
          <span className={`text-xs font-semibold text-nexura-300 ${labelSize}`}>
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div className={`w-full ${barHeight} rounded-full bg-nexura-500/15 overflow-hidden`}>
        <div
          className={`h-full rounded-full ${barGradient} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
