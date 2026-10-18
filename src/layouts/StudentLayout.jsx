import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const TITLES = {
  "/student/dashboard": "Dashboard",
  "/student/tasks": "My Tasks",
  "/student/submissions": "My Submissions",
  "/student/notifications": "Notifications",
  "/student/profile": "Profile",
};

export default function StudentLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title =
    // Parenthesised deliberately: `||` binds tighter than `?:`, so without them
    // every known route took the first branch and the header read "Task Details"
    // on the dashboard, my-tasks and profile pages alike.
    TITLES[location.pathname] ||
    (location.pathname.includes("/tasks/")
      ? "Task Details"
      : location.pathname.includes("/submissions/")
        ? "Submission Details"
        : location.pathname.includes("/submit")
          ? "Submit Task"
          : "Nexura");

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar
        role="student"
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar
          role="student"
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
