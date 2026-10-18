import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Layers, Award, Clock } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { formatDate, daysUntil, isOverdue } from "../data/mockData";

const DIFFICULTY_CONFIG = {
  Beginner: { label: "Beginner", color: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25" },
  Intermediate: { label: "Intermediate", color: "bg-amber-500/12 text-amber-400 border-amber-500/25" },
  Advanced: { label: "Advanced", color: "bg-red-500/12 text-red-400 border-red-500/25" },
};

export default function TaskCard({ task, status, to, delay = 0 }) {
  const overdue = isOverdue(task.deadline, status) && status !== "approved";
  const displayStatus = overdue && status === "not_submitted" ? "overdue" : status;
  const days = daysUntil(task.deadline);
  const difficulty = DIFFICULTY_CONFIG[task.difficulty] || DIFFICULTY_CONFIG.Intermediate;

  return (
    <Link
      to={to}
      className="card-interactive p-5 flex flex-col gap-3.5 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header: category + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-nexura-300 bg-nexura-500/10 px-2 py-0.5 rounded-md"
          >
            {task.category || "General"}
          </span>
        </div>
        {displayStatus && <StatusBadge status={displayStatus} size="sm" />}
      </div>

      {/* Title */}
      <h3 className="font-display font-semibold text-white leading-snug group-hover:text-nexura-200 transition-colors">
        {task.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-slate/80 leading-relaxed line-clamp-2">{task.description}</p>

      {/* Meta row */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs text-slate">
        <span className="inline-flex items-center gap-1.5 text-slate/70">
          <CalendarDays className="w-3.5 h-3.5" />
          Due {formatDate(task.deadline)}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${difficulty.color}`}>
          <Layers className="w-3 h-3" />
          {difficulty.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-nexura-300 font-medium">
          <Award className="w-3.5 h-3.5" />
          {task.points} pts
        </span>
      </div>

      {/* Time indicator for not submitted */}
      {status === "not_submitted" && days >= 0 && (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-nexura-400" />
          <span className={overdue ? "text-red-400" : "text-nexura-300"}>
            {days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`}
          </span>
        </div>
      )}
    </Link>
  );
}
