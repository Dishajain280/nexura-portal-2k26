import React from "react";

// Consistent shimmer for skeleton placeholders.
const shimmer = "animate-shimmer bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]";

export function SkeletonLine({ className = "", width = "100%" }) {
  return <div className={`h-4 rounded-lg ${shimmer} ${className}`} style={{ width }} />;
}

export function SkeletonCircle({ className = "", size = "md" }) {
  const sizeClasses = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  return <div className={`rounded-full ${shimmer} ${sizeClasses} ${className}`} />;
}

export function SkeletonAvatar({ size = "md" }) {
  const sizeClasses = size === "sm" ? "w-9 h-9 text-sm" : size === "lg" ? "w-14 h-14 text-2xl" : "w-11 h-11 text-base";
  return (
    <div className={`rounded-full ${shimmer} ${sizeClasses} flex items-center justify-center font-display font-semibold text-white`}>
      S
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="sm" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" />
          <SkeletonLine width="40%" />
        </div>
      </div>
      <SkeletonLine />
      <SkeletonLine width="80%" />
      <div className="flex gap-3 pt-1">
        <div className="h-6 rounded-lg flex-1" style={{ animationDelay: "0ms" }} />
        <div className="h-6 rounded-lg w-20" style={{ animationDelay: "100ms" }} />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card p-5 space-y-3">
      <SkeletonLine width="50%" />
      <SkeletonLine width="30%" style={{ height: "1.5rem" }} />
      <div className="flex justify-end">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ animationDelay: "50ms" }} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3.5">
          <SkeletonAvatar size="sm" style={{ animationDelay: `${i * 50}ms` }} />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine width="40%" style={{ animationDelay: `${i * 50}ms` }} />
            <SkeletonLine width="25%" style={{ animationDelay: `${i * 50 + 50}ms` }} />
          </div>
          <div className="h-5 rounded-lg w-16 flex items-center justify-center" style={{ animationDelay: `${i * 50 + 100}ms` }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonFormField({ label, count = 1, delay = 0 }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="h-4 w-20 rounded animate-shimmer" style={{ animationDelay: `${delay}ms` }} />}
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-11 rounded-xl animate-shimmer" style={{ animationDelay: `${delay + i * 60}ms` }} />
      ))}
    </div>
  );
}

export function SkeletonBadge() {
  return <div className="h-5 w-16 rounded-full animate-shimmer" />;
}

export default function Skeleton({ className = "" }) {
  return <div className={`rounded-lg ${shimmer} ${className}`} />;
}
