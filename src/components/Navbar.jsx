import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Bell, Search, X, Layers } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getDomainShortLabel, getAuthDomain } from "../lib/domains";

export default function Navbar({
  role,
  title,
  onOpenMobile,
  showSearch = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}) {
  const navigate = useNavigate();
  const { studentNotifs, adminNotifs, auth } = useApp();
  // A scoped coordinator's badge, so it is always visible which domain they are
  // looking at. A super-admin has no domain, and neither does a student — they
  // get no badge rather than an empty one.
  const sessionDomain = getAuthDomain(auth);
  const domainLabel =
    role === "coordinator" && sessionDomain
      ? getDomainShortLabel(sessionDomain)
      : null;
  const notifs = role === "coordinator" ? adminNotifs : studentNotifs;
  const unread = notifs.filter((n) => !n.read).length;
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const prevSearchValue = useRef(searchValue);

  // Sync input value with external changes (e.g. clearing after search)
  useEffect(() => {
    if (searchInputRef.current && prevSearchValue.current !== searchValue) {
      searchInputRef.current.value = searchValue;
      prevSearchValue.current = searchValue;
    }
  }, [searchValue]);

  return (
    <header className="sticky top-0 z-30 bg-nexura-950/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
        {/* Left: menu + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobile}
            className="lg:hidden text-nexura-300 hover:text-white p-1.5 rounded-lg hover:bg-white/8 transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-base sm:text-lg text-white truncate">
            {title}
          </h1>
          {domainLabel && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-nexura-200 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 shrink-0"
              title={`You see only the ${domainLabel} domain`}
            >
              <Layers className="w-3 h-3 shrink-0" />
              {domainLabel}
            </span>
          )}
        </div>

        {/* Right: search + notifications */}
        <div className="flex items-center gap-2.5 shrink-0">
          {showSearch && (
            <div
              className={`hidden md:flex items-center gap-2 bg-white/5 border rounded-xl px-3 py-1.5 w-56 sm:w-72 transition-all duration-200 ${
                searchFocused
                  ? "border-nexura-400/50 ring-2 ring-nexura-400/15 bg-white/[0.07]"
                  : "border-white/10 hover:border-white/15"
              }`}
            >
              <Search className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                searchFocused ? "text-nexura-300" : "text-slate"
              }`} />
              <input
                ref={searchInputRef}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={searchPlaceholder}
                className="bg-transparent outline-none text-sm w-full placeholder:text-nexura-400/50"
              />
              {searchValue && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className="text-nexura-400 hover:text-nexura-200 p-0.5 rounded hover:bg-white/5 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => navigate(`/${role}/notifications`)}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-nexura-300 hover:text-white hover:bg-white/8 transition-all duration-150 group"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
          >
            <Bell className="w-5 h-5 transition-colors duration-150 group-hover:w-5.5" />
            {unread > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full bg-accent-fuchsia text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-nexura-950 shadow-lg animate-fade-in"
                aria-hidden="true"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
