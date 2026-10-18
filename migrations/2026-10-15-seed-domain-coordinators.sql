-- ============================================================
-- Nexura Portal — seed the five domain coordinators (PHASE 1 of 5)
-- 2026-10-15
--
-- Goal: five coordinator accounts, one per club domain, each carrying the
-- `domain` value that phase 2's RLS will scope their access to.
--
-- This migration does NOT create passwords. Passwords live in auth.users, not
-- in your tables, so the accounts must be created through an auth-aware path
-- first. That split is deliberate: no credential ever belongs in this repo.
--
-- ------------------------------------------------------------
-- STEP A — create the five auth users (do this FIRST, once)
-- ------------------------------------------------------------
-- Pick one of:
--
--   a) Supabase Dashboard -> Authentication -> Users -> "Add user", with
--      "Auto Confirm User" ticked. Five times. Simplest and safest.
--
--   b) Admin API with the service_role key, from a server-side script or your
--      own machine. NEVER put the service_role key in a VITE_* variable or in
--      .env.local — anything the frontend can read is public.
--
--   c) A direct INSERT into auth.users with crypt('pw', gen_salt('bf')). Not
--      recommended: it is fragile across GoTrue versions because of the
--      identity/token columns it does not know about.
--
-- Each user's creation fires public.handle_new_user(), which creates their
-- profiles row with role 'student'. This migration then promotes that row.
--
-- The five email addresses below are the ones this script looks for. If your
-- real accounts differ, edit the VALUES list in step 2 to match — a mismatch
-- aborts the run and names the missing addresses, so it fails loudly rather
-- than silently doing nothing.
--
-- Coordinators are provisioned, not registered, so they are exempt from the
-- `.com`-only rule the public signup form enforces. `@nexura.club` matches the
-- club's own domain as the portal presents it.
--
-- ------------------------------------------------------------
-- STEP B — this file
-- ------------------------------------------------------------
-- Run in the Supabase SQL editor, after step A. Idempotent: safe to re-run.
--
-- Why the trigger dance below: trg_profiles_role_guard calls
-- public.prevent_profile_role_escalation(), which refuses any role change
-- unless public.is_admin() is true. In the SQL editor there is no session, so
-- auth.uid() is null and is_admin() is false — meaning the guard blocks the
-- promotion. The trigger is therefore disabled, the promotion runs, and the
-- trigger is re-enabled.
--
-- The three statements live inside ONE `do $$` block, which is a single
-- statement and therefore atomic: either all three happen or none do. That is
-- stronger than separate BEGIN/COMMIT lines, because it stays atomic even if
-- the SQL editor runs each statement in its own transaction — a failure
-- between the disable and the enable could otherwise leave the guard OFF, and
-- an unguarded profiles table lets any coordinator promote themselves.
-- ============================================================

do $$
declare
  v_missing   text;
  v_updated   integer;
  v_unscoped  integer;
  v_guard_ok  boolean;
begin
  -- 1. Every auth user must already exist. Otherwise the UPDATE would match
  --    nothing and the run would look successful while creating no
  --    coordinators at all.
  select string_agg(v.email, ', ' order by v.email)
    into v_missing
  from (values
    ('tech.coordinator@nexura.club'),
    ('graphics.coordinator@nexura.club'),
    ('pr.coordinator@nexura.club'),
    ('vfx.coordinator@nexura.club'),
    ('parametric.coordinator@nexura.club')
  ) as v(email)
  where not exists (
    select 1 from auth.users u where lower(u.email) = v.email
  );

  if v_missing is not null then
    raise exception
      'Seed aborted before changing anything: no auth user found for [%]. Create these accounts first (Authentication -> Users -> Add user, with Auto Confirm), then re-run. See STEP A at the top of this file.',
      v_missing;
  end if;

  -- 2. Promote and scope, with the guard temporarily off.
  --
  --    Matching is done through auth.users on u.id, not on profiles.email:
  --    profiles.email is only populated by the contact-columns migration, so
  --    joining on it would silently skip accounts created before that ran.
  execute 'alter table public.profiles disable trigger trg_profiles_role_guard';

  update public.profiles p
  set role = 'coordinator',
      domain = v.domain
  from auth.users u,
       (values
         ('tech.coordinator@nexura.club',       'technical'),
         ('graphics.coordinator@nexura.club',   'graphical'),
         ('pr.coordinator@nexura.club',         'pr_management'),
         ('vfx.coordinator@nexura.club',        'animation_vfx'),
         ('parametric.coordinator@nexura.club', 'parametric')
       ) as v(email, domain)
  where p.id = u.id
    and lower(u.email) = v.email;

  get diagnostics v_updated = row_count;

  execute 'alter table public.profiles enable trigger trg_profiles_role_guard';

  -- 3. Fail loudly if the promotion was partial. Raising here rolls the whole
  --    DO block back, so a half-configured set of coordinators cannot survive.
  if v_updated <> 5 then
    raise exception
      'Seed rolled back: expected to promote 5 profiles but updated %. Each auth user needs a matching public.profiles row (created automatically by handle_new_user on signup). No changes were kept.',
      v_updated;
  end if;

  -- 4. Prove the guard is back on. This is the check that matters most: an
  --    unguarded profiles table would let any coordinator escalate their own
  --    role or move themselves into another domain.
  select t.tgenabled = 'O'
    into v_guard_ok
  from pg_trigger t
  join pg_class c     on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles'
    and t.tgname = 'trg_profiles_role_guard';

  if not coalesce(v_guard_ok, false) then
    raise exception
      'Seed rolled back: trg_profiles_role_guard is not enabled after seeding. Re-enable it before continuing — an unguarded profiles table allows role escalation.';
  end if;

  -- 5. Report. Phase 1 is schema/account work only: nothing reads `domain`
  --    yet, so the portal behaves exactly as before until phase 2 lands.
  select count(*) into v_unscoped
  from public.profiles
  where role = 'coordinator' and domain is null;

  raise notice
    'Phase 1 complete: % coordinator(s) promoted, role guard re-enabled. % coordinator(s) still have no domain.',
    v_updated, v_unscoped;

  raise notice
    'Verify with: select email, role, domain from public.profiles where role = ''coordinator'' order by domain;';
end
$$;

-- ------------------------------------------------------------
-- Optional: the unscoped super-admin (decision 2 of the plan)
-- ------------------------------------------------------------
-- Club leadership keeps one account that sees all five domains. Not created
-- here because it is not part of the five domain coordinators. To promote an
-- existing account, run the same guarded pattern for that one email with
-- role = 'admin' and domain = null. Because is_admin() accepts role
-- 'admin' OR 'coordinator', phase 2 must introduce a separate super-admin
-- check; until then every coordinator is effectively unscoped.

-- ------------------------------------------------------------
-- Verification (run after the seed)
-- ------------------------------------------------------------
--   select email, role, domain
--   from public.profiles
--   where role = 'coordinator'
--   order by domain;
--   -- expect exactly 5 rows, one per slug, no nulls.
--
--   select tgname, tgenabled
--   from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--   where c.relname = 'profiles';
--   -- expect trg_profiles_role_guard with tgenabled = 'O'.
--
--   -- Prove the guard still bites (should raise 'Role escalation is forbidden'):
--   update public.profiles set role = 'admin' where email = 'tech.coordinator@nexura.club';

-- ------------------------------------------------------------
-- Rolling back
-- ------------------------------------------------------------
-- Phase 1 is reversible: demote each account back to student while the guard
-- is disabled, using the same single DO block. The auth users themselves are
-- deleted from Authentication -> Users, which cascades to public.profiles.
