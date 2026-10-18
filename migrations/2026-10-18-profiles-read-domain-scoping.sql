-- 2026-10-18 — domain-scope the profiles SELECT policy.
--
-- Why: the previous policy was `using (true)` ("Profiles read all"), so ANY
-- authenticated account — and the anon key — could list every profile in the
-- club. The visible symptom was rosters leaking across domains: the technical
-- coordinator's Students page and CreateTask picker showed graphical (and
-- every other domain's) students. Tasks and submissions were already scoped;
-- profiles were the last unscoped read.
--
-- New rules for SELECT:
--   * your own row (every account keeps reading itself — hydrateAuth,
--     fetchCurrentProfile, the createTask role check, profile edits), and
--   * every row of your own domain (this is what the Students page, the
--     CreateTask roster, dashboard counts and submission name resolution
--     read), evaluated through can_access_domain() so a super-admin passes
--     unconditionally and a caller without a domain reads nothing they do not
--     own, and
--   * everything, for the super-admin.
--
-- A student therefore sees their own domain's members; a coordinator of one
-- domain never sees another's. The frontend mirrors this scope in
-- src/context/AppContext.jsx (syncLiveData), so the UI is correct even before
-- this file runs — but only this policy stops the API returning rows the
-- caller must not see.
--
-- The seed/insert/update policies are untouched: signup still inserts its own
-- row, staff still update own-domain students (2026-10-16 policy), and the
-- notification functions are SECURITY DEFINER so name lookups inside them
-- keep working.

drop policy if exists "Profiles read all" on public.profiles;
drop policy if exists "Profiles read own or own domain" on public.profiles;

create policy "Profiles read own or own domain" on public.profiles
for select using (
  auth.uid() = id
  or public.is_super_admin()
  or public.can_access_domain(domain)
);

-- Self-check: run as a domain coordinator's JWT (set the role first when using
-- this file from psql, e.g. `set request.jwt.claims`), or simply confirm from
-- the app afterwards:
--   * tech.coordinator@nexura.club → only technical-domain rows (+ own row)
--   * graphics.coordinator@nexura.club → only graphical-domain rows
--   * an admin-role account → all rows
--   * signed out (anon) → zero rows
