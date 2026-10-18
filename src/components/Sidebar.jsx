import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  FolderCheck,
  Bell,
  User,
  X,
  PlusSquare,
  Users,
  Inbox,
  Zap,
  LogOut,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const STUDENT_LINKS = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/tasks", label: "My Tasks", icon: ListChecks },
  { to: "/student/submissions", label: "My Submissions", icon: FolderCheck },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/profile", label: "Profile", icon: User },
];

const COORDINATOR_LINKS = [
  { to: "/coordinator/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/coordinator/tasks", label: "Manage Tasks", icon: ListChecks },
  { to: "/coordinator/tasks/create", label: "Create Task", icon: PlusSquare },
  { to: "/coordinator/students", label: "Students", icon: Users },
  { to: "/coordinator/submissions", label: "Submissions", icon: Inbox },
  { to: "/coordinator/notifications", label: "Notifications", icon: Bell },
  { to: "/coordinator/profile", label: "Profile", icon: User },
];

export default function Sidebar({ role, mobileOpen, onCloseMobile }) {
  const { auth, logout } = useApp();
  const links = role === "coordinator" ? COORDINATOR_LINKS : STUDENT_LINKS;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-nexura-950/60 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 h-screen w-72 bg-nexura-gradient text-white flex flex-col z-50 border-r border-white/[0.06] shadow-2xl shadow-black/30 transition-transform duration-300 shrink-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center shrink-0 shadow-glow-purple shadow-lg">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <p className="font-display font-extrabold text-base tracking-wide leading-none">
                NEXURA
              </p>
              <p className="text-[11px] text-nexura-200 mt-1 tracking-wide">
                {role === "coordinator"
                  ? "Coordinator Portal"
                  : "Member Portal"}
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-nexura-200 hover:text-white p-1.5 rounded-lg hover:bg-white/8 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-0.5">
          {links.map((link) => {
            const { to, label, icon: Icon } = link;
            return (
              <NavLink
                key={to}
                to={to}
                end
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `nav-link group ${isActive ? "nav-link-active" : ""}`
                }
              >
                {/* Children must be a render prop too: `isActive` is only in
                    scope inside the callbacks NavLink passes it to, so
                    referencing it from plain JSX children threw
                    "ReferenceError: isActive is not defined" and blanked the
                    whole portal behind the error boundary. */}
                {({ isActive }) => (
                  <>
                    <Icon className={"w-[18px] h-[18px] shrink-0 transition-colors duration-150 group-hover:w-[19px] " + (isActive ? "text-white" : "text-nexura-300 group-hover:text-white")} />
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-nexura-300 shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="mx-3 mb-3 pt-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 px-2 py-2.5 mb-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ring-2 ring-white/10"
              style={{ backgroundColor: auth?.user?.avatarColor || "#7C3AED" }}
            >
              {auth?.user?.name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {auth?.user?.name || "User"}
              </p>
              <p className="text-xs text-nexura-300 truncate">
                {auth?.user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-nexura-300 hover:text-white hover:bg-white/8 transition-all duration-150 group"
          >
            <LogOut className="w-[17px] h-[17px] shrink-0 transition-colors group-hover:text-red-400" />
            <span className="flex-1 text-left">Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
