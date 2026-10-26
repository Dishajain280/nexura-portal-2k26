import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { isCoordinatorRole } from "../../lib/roleGuard";

export default function Login() {
  const { login, pushToast } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("aarav.mehta@nexura.club");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!email.trim()) errs.email = "Email is required";
    if (!password.trim()) errs.password = "Password is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const authState = await login(role, email, password);
      pushToast(
        `Welcome back! Logged in as ${isCoordinatorRole(authState.role) ? "coordinator" : "member"}.`,
      );
      const isCoord = isCoordinatorRole(authState?.role);
      navigate(isCoord ? "/coordinator/dashboard" : "/student/dashboard");
    } catch (error) {
      setErrors({ form: error.message || "Login failed" });
      pushToast(error.message || "Login failed", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nexura-950 bg-nexura-radial flex items-center justify-center p-4 sm:p-6">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-nexura-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent-fuchsia/5 rounded-full blur-3xl -z-10" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 shrink-0">
            <img
              src="/nexura-logo.png"
              alt="Nexura"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-display font-extrabold text-lg tracking-wide text-white">
            NEXURA
          </span>
        </Link>

        <div className="glass-panel rounded-2xl p-5 sm:p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-nexura-300 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Sign in to your account
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Welcome back
            </h1>
            <p className="text-sm text-nexura-300 mt-1.5">
              Log in to continue to your dashboard
            </p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2 mt-4 p-1.5 rounded-xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                role === "student"
                  ? "bg-white text-nexura-700 shadow-sm ring-1 ring-white/20"
                  : "text-nexura-200 hover:text-white hover:bg-white/5"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => setRole("coordinator")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                role === "coordinator"
                  ? "bg-white text-nexura-700 shadow-sm ring-1 ring-white/20"
                  : "text-nexura-200 hover:text-white hover:bg-white/5"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Coordinator
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-nexura-200 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-nexura-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@nexura.club"
                  className="input-field pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3 shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-nexura-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-nexura-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pl-10"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3 shrink-0" />
                  {errors.password}
                </p>
              )}
              {errors.form && (
                <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                  <Lock className="w-3 h-3 shrink-0" />
                  {errors.form}
                </p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                Log in as {role === "coordinator" ? "coordinator" : "member"}
              </span>
              <span className="sm:hidden">
                {role === "coordinator" ? "Log in as coordinator" : "Log in"}
              </span>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-nexura-400 mb-4">
              Forgot your password? Reset it from your Supabase dashboard or ask your coordinator.
            </p>
            <p className="text-sm text-nexura-300">
              Don't have an account?{" "}
              <Link to="/signup" className="text-white font-semibold hover:text-nexura-200 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
