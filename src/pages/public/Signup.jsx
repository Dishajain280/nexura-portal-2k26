import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Layers,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { DOMAINS } from "../../lib/domains";

export default function Signup() {
  const { signup, pushToast } = useApp();
  const navigate = useNavigate();
  // `domain` deliberately starts empty rather than defaulting to the first
  // domain: a student's domain decides which tasks they can see, so it should
  // be a real choice, not whatever happens to be first in the list.
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    domain: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Full name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = "Enter a valid email";
    if (!form.domain) errs.domain = "Choose your domain";
    if (!form.password.trim()) errs.password = "Password is required";
    else if (form.password.length < 6)
      errs.password = "Use at least 6 characters";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      // Signup is strictly student-only — the DB trigger creates every new
      // profile with role 'student', and coordinator accounts are provisioned
      // by admins, never through public registration. Onboarding therefore
      // always lands on the student portal.
      const data = await signup(
        form.name,
        form.email,
        form.password,
        "student",
        form.domain,
      );
      pushToast(`Account created — welcome to Nexura, member!`);
      if (data?.user) {
        navigate("/student/dashboard");
      }
    } catch (error) {
      setErrors({ form: error.message || "Signup failed" });
      pushToast(error.message || "Signup failed", "danger");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = form.password.length === 0
    ? 0
    : form.password.length < 6
      ? 1
      : form.password.length < 10
        ? 2
        : form.password.length >= 10
          ? 3
          : 2;

  const strengthLabel =
    passwordStrength === 0
      ? ""
      : passwordStrength === 1
        ? "Weak"
        : passwordStrength === 2
          ? "Fair"
          : "Good";

  const strengthColor =
    passwordStrength === 0
      ? "bg-white/10"
      : passwordStrength <= 1
        ? "bg-red-500/40"
        : passwordStrength === 2
          ? "bg-amber-500/40"
          : "bg-emerald-500/40";

  return (
    <div className="min-h-screen bg-nexura-950 bg-nexura-radial flex items-center justify-center p-4 sm:p-6">
      {/* Background glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent-fuchsia/8 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-nexura-500/8 rounded-full blur-3xl -z-10" />

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
              Create your account
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Join Nexura
            </h1>
            <p className="text-sm text-nexura-300 mt-1.5">
              Create your member account to start receiving tasks
            </p>
          </div>

          {/* Role notice */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-nexura-500/8 border border-nexura-500/15 mb-5">
            <div className="w-8 h-8 rounded-lg bg-nexura-500/15 text-nexura-300 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <p className="text-xs text-nexura-300 leading-relaxed">
              Coordinator accounts are provisioned by the team — contact the faculty
              coordinator to get one.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nexura-200 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-nexura-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={form.name}
                  onChange={update("name")}
                  placeholder="Aarav Mehta"
                  className="input-field pl-10"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <UserIcon className="w-3 h-3 shrink-0" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-nexura-200 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-nexura-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="you@nexura.club"
                  className="input-field pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Mail className="w-3 h-3 shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-nexura-200 mb-1.5">
                Your domain
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-nexura-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={form.domain}
                  onChange={update("domain")}
                  className="input-field pl-10"
                >
                  <option value="">Select your club domain…</option>
                  {DOMAINS.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-nexura-400 mt-1.5">
                You&apos;ll receive tasks from this domain. Ask a coordinator if
                you are not sure which one you belong to.
              </p>
              {errors.domain && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3 shrink-0" />
                  {errors.domain}
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
                  value={form.password}
                  onChange={update("password")}
                  placeholder="At least 6 characters"
                  className="input-field pl-10 pr-10"
                />
                {form.password && (
                  <Lock
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-150 ${
                      passwordStrength >= 2 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  />
                )}
              </div>

              {/* Password strength */}
              {form.password && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                          level <= passwordStrength ? strengthColor : "bg-white/5"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-nexura-300">
                    {strengthLabel !== "Good"
                      ? strengthLabel
                        ? `Password strength: ${strengthLabel}`
                        : "At least 6 characters"
                      : "Good password"}
                  </p>
                </div>
              )}

              {errors.password && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3 shrink-0" />
                  {errors.password}
                </p>
              )}
            </div>

            {errors.form && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3.5 py-2.5">
                {errors.form}
              </p>
            )}

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
              Create member account
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-nexura-300">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-white font-semibold hover:text-nexura-200 hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
