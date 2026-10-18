import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { isCoordinatorRole } from "./lib/roleGuard";
import ToastContainer from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

// Route-level code splitting. Portal pages and both shells are loaded on
// demand so the initial bundle stays small: a visitor on /login never
// downloads the coordinator pages, and a student never downloads the review
// screens. The shell (context, router, toasts, error boundary) stays eager
// because every route needs it.
//
// The public entry pages stay eager. Landing and Login are what first-time
// visitors land on, Signup is behind every "Get started" CTA, and
// AuthCallback is on the critical path of every auth return link — making any
// of them lazy would add a round-trip before the user sees anything. Everything
// behind a login is deferrable, which is where the real weight is.
import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
import Signup from "./pages/public/Signup";
import AuthCallback from "./pages/public/AuthCallback";

const StudentLayout = lazy(() => import("./layouts/StudentLayout"));
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const MyTasks = lazy(() => import("./pages/student/MyTasks"));
const TaskDetails = lazy(() => import("./pages/student/TaskDetails"));
const SubmitTask = lazy(() => import("./pages/student/SubmitTask"));
const MySubmissions = lazy(() => import("./pages/student/MySubmissions"));
const SubmissionDetails = lazy(() => import("./pages/student/SubmissionDetails"));
const StudentNotifications = lazy(() => import("./pages/student/Notifications"));
const StudentProfile = lazy(() => import("./pages/student/Profile"));

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const ManageTasks = lazy(() => import("./pages/admin/ManageTasks"));
const CreateTask = lazy(() => import("./pages/admin/CreateTask"));
const Students = lazy(() => import("./pages/admin/Students"));
const Submissions = lazy(() => import("./pages/admin/Submissions"));
const ReviewSubmission = lazy(() => import("./pages/admin/ReviewSubmission"));
const AdminNotifications = lazy(() => import("./pages/admin/Notifications"));
const AdminProfile = lazy(() => import("./pages/admin/Profile"));

// Shown while a route chunk is being fetched. Matches the app's dark surface
// so a slow chunk never flashes a white screen.
function RouteFallback() {
  return (
    <div className="min-h-screen bg-nexura-950 bg-nexura-radial flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-sm text-nexura-300">Loading…</span>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { auth } = useApp();
  const isCoordinator = auth ? isCoordinatorRole(auth.role) : false;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />      <Route path="/login"
          element={
            auth ? (
              <Navigate
                to={
                  isCoordinator ? "/coordinator/dashboard" : "/student/dashboard"
                }
                replace
              />
            ) : (
              <Login />
            )
          }
        />
        {/* Signup renders the real page. It previously redirected to /login,
            which silently broke every "Get started" / "Sign up" link on the
            site — new students could not register at all. Already-authenticated
            users skip straight to their dashboard instead. */}
        <Route
          path="/signup"
          element={
            auth ? (
              <Navigate
                to={
                  isCoordinator ? "/coordinator/dashboard" : "/student/dashboard"
                }
                replace
              />
            ) : (
              <Signup />
            )
          }
        />

        {/* Auth links (email confirmation at signup, password recovery) return
            to this address to finish the exchange. Previously no such route
            existed, so the catch-all dropped returning users on the landing
            page. */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="tasks" element={<MyTasks />} />
          <Route path="tasks/:id" element={<TaskDetails />} />
          <Route path="tasks/:id/submit" element={<SubmitTask />} />
          <Route path="submissions" element={<MySubmissions />} />
          <Route path="submissions/:id" element={<SubmissionDetails />} />
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        {/* Coordinator */}
        <Route
          path="/coordinator"
          element={
            <ProtectedRoute role="coordinator">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="tasks" element={<ManageTasks />} />
          <Route path="tasks/create" element={<CreateTask />} />
          <Route path="students" element={<Students />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="submissions/:id" element={<ReviewSubmission />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        {/* Admin Route Aliases for backwards compatibility */}
        <Route
          path="/admin"
          element={<Navigate to="/coordinator/dashboard" replace />}
        />
        <Route
          path="/admin/dashboard"
          element={<Navigate to="/coordinator/dashboard" replace />}
        />
        <Route
          path="/admin/tasks"
          element={<Navigate to="/coordinator/tasks" replace />}
        />
        <Route
          path="/admin/tasks/create"
          element={<Navigate to="/coordinator/tasks/create" replace />}
        />
        <Route
          path="/admin/students"
          element={<Navigate to="/coordinator/students" replace />}
        />
        <Route
          path="/admin/submissions"
          element={<Navigate to="/coordinator/submissions" replace />}
        />
        <Route
          path="/admin/submissions/:id"
          element={<Navigate to="/coordinator/submissions" replace />}
        />
        <Route
          path="/admin/notifications"
          element={<Navigate to="/coordinator/notifications" replace />}
        />
        <Route
          path="/admin/profile"
          element={<Navigate to="/coordinator/profile" replace />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          <ToastContainer />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
