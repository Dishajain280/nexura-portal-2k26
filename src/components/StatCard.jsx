import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const TONE_CONFIG = {
  purple: { bg: "bg-nexura-500/12", text: "text-nexura-300", ring: "ring-nexura-500/10" },
  success: { bg: "bg-emerald-500/12", text: "text-emerald-400", ring: "ring-emerald-500/10" },
  warning: { bg: "bg-amber-500/12", text: "text-amber-400", ring: "ring-amber-500/10" },
  danger: { bg: "bg-red-500/12", text: "text-red-400", ring: "ring-red-500/10" },
  slate: { bg: "bg-white/8", text: "text-nexura-200", ring: "ring-white/5" },
};

export default function StatCard({ label, value, icon: Icon, tone = "purple", trend, delay = 0 }) {
  const cfg = TONE_CONFIG[tone] || TONE_CONFIG.purple;
  const trendIcon = trend?.startsWith("+") ? ArrowUp : trend?.startsWith("-") ? ArrowDown : Minus;
  const trendColor = trend?.startsWith("+") ? "text-emerald-400" : trend?.startsWith("-") ? "text-red-400" : "text-slate";

  return (
    <div
      className={`card-interactive p-5 flex items-start justify-between animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div>
        <p className="text-sm text-nexura-200 font-medium">{label}</p>
        <p className="text-3xl font-display font-bold text-white mt-1.5 tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {trend && (
          <div className="flex items-center gap-1 mt-1.5">
            <trendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
            <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
          </div>
        )}
      </div>
      {Icon && (
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring} transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
