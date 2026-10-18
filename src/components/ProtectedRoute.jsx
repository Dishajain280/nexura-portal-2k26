import React from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isCoordinatorRole } from "../lib/roleGuard";

export default function ProtectedRoute({ role, children }) {
  const { auth, authReady } = useApp();

  // The session bootstrap is asynchronous (profile fetch, demo-session
  // restore). Redirecting while it is still in flight is what used to bounce
  // a hard refresh of /student/profile to the dashboard: auth was null for
  // one tick, so this guard sent the user to /login, and the public-route
  // guard then redirected the restored session to its home page — the URL
  // the user actually asked for was silently discarded. Wait for the verdict.
  if (!authReady) {
    return (
      <div className="min-h-screen bg-nexura-950 bg-nexura-radial flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-sm text-nexura-300">Loading…</span>
        </div>
      </div>
    );
  }

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  const isAllowedCoordinator = isCoordinatorRole(auth.role);

  if (role === "coordinator") {
    if (!isAllowedCoordinator) {
      return <Navigate to="/student/dashboard" replace />;
    }
  } else if (role === "student") {
    if (isAllowedCoordinator) {
      return <Navigate to="/coordinator/dashboard" replace />;
    }
  }

  return children;
}
