-- ============================================================
-- Nexura Portal — persist the signup domain choice (PHASE 3, database half)
-- 2026-10-15
--
-- The signup form now asks a student to pick one of the five club domains
-- (decision 1: students choose at signup). That choice arrives as Supabase user
-- metadata, because the browser cannot write it to public.profiles directly —
-- and cannot be allowed to, since the same column decides what the account may
-- read.
--
-- public.handle_new_user() runs server-side on auth.users and is the only place
-- that can persist it. WITHOUT THIS MIGRATION THE PICKER IS COSMETIC: every new
-- account would keep domain = null and, once phase 2's policies are live, see
-- an empty portal.
--
-- The value is client-supplied metadata, so it is treated as untrusted: only
-- one of the five known slugs is stored. Anything else is discarded rather than
-- passed through to the profiles.domain CHECK constraint, which would abort the
-- entire signup and leave the user with no profile at all.
--
-- The role rule is unchanged and remains absolute: profiles are always created
-- with role 'student'. Nothing in this trigger reads a role from metadata.
--
-- Prerequisites: phase 0 (2026-10-15-domain-scoping.sql) — the domain column.
-- Idempotent: safe to re-run.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
begin
  -- Fail with something actionable rather than a raw "column domain does not
  -- exist" that aborts every signup with no explanation.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'domain'
  ) then
    raise exception
      'Prerequisite missing: public.profiles.domain does not exist. Run migrations/2026-10-15-domain-scoping.sql first.';
  end if;

  -- Accept a domain only when it is one of the five known slugs.
  v_domain := nullif(btrim(new.raw_user_meta_data->>'domain'), '');
  if v_domain is not null and v_domain not in (
    'technical', 'graphical', 'pr_management', 'animation_vfx', 'parametric'
  ) then
    v_domain := null;
  end if;

  insert into public.profiles (id, name, role, email, domain)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    -- Never taken from client metadata: a signup that passed a role would
    -- otherwise create a real coordinator account.
    'student',
    new.email,
    v_domain
  )
  on conflict (id) do update
    set name   = excluded.name,
        email  = coalesce(excluded.email, public.profiles.email),
        -- Only ever fill a missing domain. An existing one is authoritative and
        -- must not be silently rewritten by a later metadata value.
        domain = coalesce(excluded.domain, public.profiles.domain);

  return new;
end;
$$;

-- Verification
-- ------------
--   -- The function is the only writer of a signup domain:
--   select proname from pg_proc where proname = 'handle_new_user';
--
--   -- After a test signup that chose 'graphical':
--   select p.email, p.role, p.domain
--   from public.profiles p
--   join auth.users u on u.id = p.id
--   where u.email = 'your.test@example.com';
--   -- expect role 'student' and domain 'graphical'.
--
--   -- A tampered domain must NOT reach the table. Repeat the signup sending
--   -- domain: 'not_a_domain' — expect domain NULL, and no failed signup.
