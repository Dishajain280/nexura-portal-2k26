import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, AlertCircle, ArrowRight } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { isCoordinatorRole } from "../../lib/roleGuard";

// Where every auth return link lands: the `emailRedirectTo` that signUpUser()
// sends with a registration, and any other Supabase auth callback. Supabase
// parses the returned tokens because supabaseClient sets
// `detectSessionInUrl: true`, which fires SIGNED_IN and makes AppContext
// hydrate `auth`. This page waits for that to happen and then routes by the
// account's real role.
//
// Without this route the catch-all sent users to "/", which looked like a
// successful sign-in but silently dropped them on the public landing page.
const TIMEOUT_MS = 8000;

export default function AuthCallback() {
  const { auth } = useApp();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "working", message: "" });
  const handled = useRef(false);

  // Supabase reports a failed exchange in the URL (query OR hash), e.g. when a
  // confirmation link has expired or the redirect URL is not allowlisted.
  // Surface that instead of waiting for a session forever.
  useEffect(() => {
    try {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(
        String(window.location.hash || "").replace(/^#/, ""),
      );
      const message =
        query.get("error_description") ||
        hash.get("error_description") ||
        query.get("error") ||
        hash.get("error");

      if (message) {
        setState({
          status: "error",
          message: String(message).replace(/\+/g, " "),
        });
      }
    } catch {
      /* malformed URL — fall through to the normal wait */
    }
  }, []);

  // Route once the session is hydrated. The role comes from the database
  // profile (see buildAuthState), so it is authoritative.
  useEffect(() => {
    if (!auth || handled.current) return;
    handled.current = true;

    navigate(
      isCoordinatorRole(auth.role) ? "/coordinator/dashboard" : "/student/dashboard",
      { replace: true },
    );
  }, [auth, navigate]);

  // Give up after a bounded wait so a stalled exchange doesn't leave the user
  // staring at a spinner with no way forward.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) =>
        prev.status === "working"
          ? {
              status: "error",
              message:
                "We couldn't complete the sign-in. Please try again from the login page.",
            }
          : prev,
      );
    }, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const isError = state.status === "error";

  return (
    <div className="min-h-screen bg-nexura-950 bg-nexura-radial flex items-center justify-center p-4 sm:p-6">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-nexura-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent-fuchsia/5 rounded-full blur-3xl -z-10" />

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center shadow-glow-purple shadow-lg">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-wide text-white">
            NEXURA
          </span>
        </Link>

        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-xl text-center">
          {isError ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h1 className="font-display text-xl font-bold text-white">
                Sign-in didn&apos;t finish
              </h1>
              <p
                className="text-sm text-nexura-300 mt-2 break-words"
                role="alert"
              >
                {state.message}
              </p>
              <Link
                to="/login"
                className="btn-primary w-full py-3 mt-6 inline-flex items-center justify-center gap-2"
              >
                Back to login <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <h1 className="font-display text-xl font-bold text-white">
                Signing you in…
              </h1>
              <p className="text-sm text-nexura-300 mt-2">
                Finishing sign-in and loading your dashboard.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
