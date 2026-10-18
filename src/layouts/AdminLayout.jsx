import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const TITLES = {
  "/coordinator/dashboard": "Dashboard",
  "/coordinator/tasks": "Manage Tasks",
  "/coordinator/tasks/create": "Create Task",
  "/coordinator/students": "Students",
  "/coordinator/submissions": "Submissions",
  "/coordinator/notifications": "Notifications",
  "/coordinator/profile": "Profile",
};

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title =
    // Precedence: without the parentheses `||` binds tighter than `?:`, so the
    // whole expression became `TITLES[path] || includes(...) ? "Review
    // Submission" : …` — every KNOWN route therefore matched the first branch
    // and the header read "Review Submission" on the dashboard, task list and
    // students page alike.
    TITLES[location.pathname] ||
    (location.pathname.includes("/submissions/")
      ? "Review Submission"
      : location.pathname.includes("/tasks/edit")
        ? "Edit Task"
        : "Nexura");

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar
        role="coordinator"
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar
          role="coordinator"
          title={title}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
