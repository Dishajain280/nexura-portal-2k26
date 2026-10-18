// The five Nexura club domains — the single source of truth for the database
// slug, the display label, and the historical task-category string.
//
// Two identifiers, deliberately different:
//   * `slug`  — stable and machine-facing. Stored in `profiles.domain` and
//               `tasks.domain`, and used by the domain-scoped authorization
//               that phase 2 adds. Slugs are duplicated as CHECK constraints in
//               `database.sql` and `migrations/2026-10-15-domain-scoping.sql`:
//               changing one here means writing a new migration, not editing a
//               string.
//   * `label` — human-facing copy, mirroring the club's "Our Domains" material
//               so the portal reads the way students see the club organized.
//
// `label` is also the value `tasks.category` has always held. Task cards, the
// task detail views and the review screens all render `category`, and the
// migration backfills `domain` from it — so these strings must stay exact.
// Rewording one silently un-categorises every existing row and breaks that
// backfill.
export const DOMAINS = Object.freeze([
  { slug: "technical", label: "Technical domain" },
  { slug: "graphical", label: "Graphical domain" },
  { slug: "pr_management", label: "PR and Management domain" },
  { slug: "animation_vfx", label: "3D Animation and VFX domain" },
  {
    slug: "parametric",
    label: "Parametric Modelling and Simulation domain",
  },
]);

export const DOMAIN_SLUGS = Object.freeze(DOMAINS.map((domain) => domain.slug));

// The category strings the task form lists. Same five values in the same order
// as before this module existed: the form maps over this list and defaults to
// its first entry, so reordering it changes the default selection.
export const TASK_CATEGORIES = Object.freeze(
  DOMAINS.map((domain) => domain.label),
);

export const getDomainLabel = (slug) =>
  DOMAINS.find((domain) => domain.slug === slug)?.label ?? null;

// A compact label for badges and chips, where the full "… domain" suffix would
// dominate the layout: "Parametric Modelling and Simulation domain" becomes
// "Parametric Modelling and Simulation".
export const getDomainShortLabel = (slug) =>
  getDomainLabel(slug)?.replace(/\s+domain$/, "") ?? null;

export const getDomainSlug = (label) =>
  DOMAINS.find((domain) => domain.label === label)?.slug ?? null;

// The domain an auth session is scoped to.
//
// `buildAuthState()` sets it on the session AND on `session.user`, but a
// hand-built session — the offline demo logins, the no-backend signup fallback —
// can carry it on only one of the two. Reading both here means a caller cannot
// silently see `null` just because it looked at the other level, which is how
// the coordinator domain badge and the locked task form went missing in demo
// mode while looking correct in production.
export const getAuthDomain = (auth) =>
  auth?.domain || auth?.user?.domain || null;

export const isDomainSlug = (value) =>
  DOMAINS.some((domain) => domain.slug === value);

export default {
  DOMAINS,
  DOMAIN_SLUGS,
  TASK_CATEGORIES,
  getDomainLabel,
  getDomainShortLabel,
  getDomainSlug,
  isDomainSlug,
};
