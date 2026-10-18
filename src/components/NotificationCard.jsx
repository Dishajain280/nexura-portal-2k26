import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  ClipboardList,
  Clock,
  Info,
  Send,
  Trash2,
} from "lucide-react";
import { timeAgo } from "../data/mockData";

const CONFIG = {
  approved: {
    Icon: CheckCircle2,
    bg: "bg-emerald-500/12",
    text: "text-emerald-400",
    ring: "ring-emerald-500/10",
  },
  rejected: {
    Icon: XCircle,
    bg: "bg-red-500/12",
    text: "text-red-400",
    ring: "ring-red-500/10",
  },
  submitted: {
    Icon: Send,
    bg: "bg-nexura-500/15",
    text: "text-nexura-300",
    ring: "ring-nexura-500/10",
  },
  resubmitted: {
    Icon: Send,
    bg: "bg-nexura-500/15",
    text: "text-nexura-300",
    ring: "ring-nexura-500/10",
  },
  removed: {
    Icon: Trash2,
    bg: "bg-red-500/12",
    text: "text-red-400",
    ring: "ring-red-500/10",
  },
  task: {
    Icon: ClipboardList,
    bg: "bg-nexura-500/15",
    text: "text-nexura-300",
    ring: "ring-nexura-500/10",
  },
  pending: {
    Icon: Clock,
    bg: "bg-amber-500/12",
    text: "text-amber-400",
    ring: "ring-amber-500/10",
  },
  reminder: {
    Icon: Clock,
    bg: "bg-amber-500/12",
    text: "text-amber-400",
    ring: "ring-amber-500/10",
  },
  info: {
    Icon: Info,
    bg: "bg-white/8",
    text: "text-nexura-200",
    ring: "ring-white/5",
  },
};

export default function NotificationCard({ notification, onRead }) {
  const navigate = useNavigate();
  const cfg = CONFIG[notification.type] || CONFIG.info;
  const { Icon, bg, text, ring } = cfg;

  const handleClick = () => {
    onRead?.(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3.5 text-left px-4 py-3.5 rounded-xl transition-all duration-150 border ${
        notification.read
          ? "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/8"
          : `${bg} border-nexura-400/25 hover:bg-nexura-500/18 hover:border-nexura-400/30`
      }`}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg} ${text} ring-1 ${ring} transition-transform duration-150 hover:scale-105`}
      >
        <Icon className="w-4.5 h-4.5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{notification.title}</p>
          {!notification.read && (
            <span
              className="w-2 h-2 rounded-full bg-nexura-400 shrink-0 ring-1 ring-nexura-900/50 animate-pulse-glow"
              aria-label="Unread"
            />
          )}
        </div>
        <p className="text-sm text-slate/80 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-xs text-slate/50 mt-1.5">{timeAgo(notification.time)}</p>
      </div>
    </button>
  );
}
