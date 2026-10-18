import React from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  ArrowRight,
  GitBranch,
  UploadCloud,
  CheckCircle2,
  MessageSquareText,
  Layers,
  ShieldCheck,
  Users,
  BarChart3,
  Sparkles,
} from "lucide-react";

const PIPELINE = [
  {
    label: "Task Assigned",
    icon: Layers,
    desc: "Coordinators publish tasks with requirements & deadlines",
  },
  {
    label: "Work Submitted",
    icon: UploadCloud,
    desc: "Members attach files, GitHub repos, and live links",
  },
  {
    label: "Under Review",
    icon: MessageSquareText,
    desc: "Coordinators inspect the work and leave feedback",
  },
  {
    label: "Approved",
    icon: CheckCircle2,
    desc: "Approved work is logged — or sent back to resubmit",
  },
];

const FEATURES = [
  {
    icon: GitBranch,
    title: "Real submission trail",
    desc:
      "GitHub repos, live deploy links, and files — every attempt tracked, nothing lost between resubmissions.",
  },
  {
    icon: ShieldCheck,
    title: "Clear review loop",
    desc:
      "Coordinators approve or reject with feedback attached, so rejected work always comes with a way forward.",
  },
  {
    icon: BarChart3,
    title: "Progress at a glance",
    desc:
      "Dashboards surface pending reviews, deadlines, and approval rates for members and coordinators alike.",
  },
  {
    icon: Users,
    title: "Built for the whole club",
    desc:
      "One roster, one task board — coordinators assign, members deliver, nobody chases status over email.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-nexura-950 text-white overflow-x-hidden">
      {/* Nav */}
      <header className="relative z-10 max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-5 sm:py-6 gap-3">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cta-gradient flex items-center justify-center shadow-glow-purple shadow-lg shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="white" />
          </div>
          <span className="font-display font-extrabold text-base sm:text-lg tracking-wide truncate">
            NEXURA
          </span>
        </div>

        <nav className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Link
            to="/login"
            className="text-sm font-medium text-nexura-200 hover:text-white px-2.5 sm:px-4 py-2 transition-colors whitespace-nowrap"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="btn-primary text-sm px-3.5 sm:px-4 py-2 whitespace-nowrap inline-flex items-center gap-1.5"
          >
            Join Now <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative bg-nexura-radial py-8 sm:py-12">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent-fuchsia/10 to-transparent rounded-full blur-3xl -z-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-nexura-500/20 rounded-full blur-3xl -z-50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Left: copy */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-nexura-300 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              For Nexura members & coordinators
            </span>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Where tasks move from{" "}
              <span className="bg-gradient-to-r from-nexura-300 via-accent-fuchsia to-accent-pink bg-clip-text text-transparent">
                assigned
              </span>{" "}
              to{" "}
              <span className="bg-gradient-to-r from-accent-pink via-nexura-300 to-accent-fuchsia bg-clip-text text-transparent">
                approved.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-nexura-200 max-w-lg leading-relaxed">
              Nexura's task portal replaces scattered spreadsheets and DMs with one
              place to assign work, submit it, and track every review — from first
              draft to final approval.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/signup"
                className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2"
              >
                Create your account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="text-sm font-semibold text-white/90 hover:text-white border border-white/15 hover:border-white/30 rounded-xl px-6 py-3 transition-colors inline-flex items-center gap-2"
              >
                I already have an account <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-nexura-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-nexura-400" />
                <span>Real-time submission tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-nexura-400" />
                <span>Structured review feedback</span>
              </div>
            </div>
          </div>

          {/* Right: pipeline visual */}
          <div className="relative">
            {/* Glow behind card */}
            <div className="absolute -inset-4 bg-gradient-to-br from-nexura-500/20 to-accent-fuchsia/10 rounded-full blur-2xl -z-10" />

            <div className="glass-panel rounded-2xl p-5 sm:p-7 shadow-glow-purple shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-nexura-300 mb-6 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                The task lifecycle
              </p>

              <div className="relative">
                {PIPELINE.map((step, i) => {
                  const Icon = step.icon;
                  const isLast = i === PIPELINE.length - 1;
                  return (
                    <div key={step.label} className="relative flex gap-4 pb-7 last:pb-0">
                      {/* Connector line */}
                      {!isLast && (
                        <div className="absolute left-[18px] top-12 w-px h-16 bg-gradient-to-b from-nexura-400/40 to-transparent" />
                      )}

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-cta-gradient flex items-center justify-center shrink-0 shadow-glow-purple z-10 relative">
                        <Icon className="w-[18px] h-[18px] text-white" />
                      </div>

                      {/* Text */}
                      <div className="pt-1.5">
                        <p className="font-display font-semibold text-white">{step.label}</p>
                        <p className="text-sm text-nexura-300 mt-0.5 leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-nexura-900 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="max-w-xl mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Everything the club needs, nothing it doesn't
            </h2>
            <p className="text-nexura-300 mt-3 leading-relaxed">
              A focused workflow for coordinators to assign work and review it — and for
              members to submit it without the back-and-forth.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass-panel rounded-xl2 p-5 hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 group animate-fade-in-up hover:-translate-y-0.5"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="w-10 h-10 rounded-lg bg-nexura-500/15 text-nexura-300 flex items-center justify-center mb-4 ring-1 ring-nexura-500/10 group-hover:ring-nexura-400/20 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-nexura-300 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="relative rounded-2xl bg-cta-gradient p-6 sm:p-10 md:p-14 text-center overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to move your next task forward?
            </h2>
            <p className="text-white/85 mt-3 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
              Log in as a member to see your assigned tasks, or as a coordinator to
              start reviewing submissions.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/signup"
                className="bg-white text-nexura-700 font-semibold rounded-xl px-6 py-3 text-sm hover:bg-nexura-50 transition-colors inline-flex items-center gap-2"
              >
                Join Nexura <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/login"
                className="border border-white/40 text-white font-semibold rounded-xl px-6 py-3 text-sm hover:bg-white/10 transition-colors inline-flex items-center gap-2"
              >
                I already have one <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-nexura-400">
          <span>© 2026 Nexura Technical Club. All rights reserved.</span>
          <span>Built by members, for members.</span>
        </div>
      </footer>
    </div>
  );
}