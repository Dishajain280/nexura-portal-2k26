-- ============================================================
-- Nexura Portal — domain scoping, PHASE 0 of 5 (2026-10-15)
--
-- Goal of this migration (and only this one): give tasks and profiles a
-- first-class `domain`, so that a later phase can scope a coordinator's access
-- to a single club domain.
--
-- This migration is deliberately ADDITIVE. It adds columns, backfills the rows
-- it can map, and adds indexes. It changes NO policy, NO trigger and NO
-- function, so the portal behaves exactly as it did before it ran.
--
-- Why slugs rather than the display strings: `tasks.category` holds
-- human-facing text ("Technical domain"). An authorization key must be stable
-- and compact, so `domain` stores the slugs below while `category` stays the
-- display value. The two are written together by the app in a later phase.
--
-- Not in this phase, on purpose:
--   * NOT NULL / defaults  — the app does not send `domain` yet, so a NOT NULL
--                            column would break task creation immediately.
--   * RLS policies         — phase 2. Until then nothing reads `domain`, and
--                            hiding rows now would be a behaviour change.
--   * tasks.created_by     — phase 2, where ownership is actually used.
--
-- Run in the Supabase SQL editor. Idempotent: safe to run more than once.
-- ============================================================

-- 1) Columns.
--    Nullable by design. Existing tasks are backfilled in step 3 where a
--    mapping exists; `tasks.category` defaults to 'General', which maps to no
--    domain, and the app does not yet send a domain on insert.
alter table public.profiles add column if not exists domain text;
alter table public.tasks    add column if not exists domain text;

-- 2) Constrain `domain` to the five club slugs, while still allowing null.
--    Postgres has no "add constraint if not exists", so guard on pg_constraint
--    to keep the whole migration re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_domain_valid'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_domain_valid
      check (
        domain is null or domain in (
          'technical', 'graphical', 'pr_management', 'animation_vfx', 'parametric'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_domain_valid'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_domain_valid
      check (
        domain is null or domain in (
          'technical', 'graphical', 'pr_management', 'animation_vfx', 'parametric'
        )
      );
  end if;
end
$$;

-- 3) Backfill existing tasks from their display category.
--    Only the five known labels map. Anything else — notably the 'General'
--    default — is left null on purpose: guessing a domain for those rows would
--    silently mis-scope real work. The notice at the end reports how many.
update public.tasks
set domain = case category
  when 'Technical domain'                       then 'technical'
  when 'Graphical domain'                       then 'graphical'
  when 'PR and Management domain'               then 'pr_management'
  when '3D Animation and VFX domain'            then 'animation_vfx'
  when 'Parametric Modelling and Simulation domain' then 'parametric'
end
where domain is null
  and category in (
    'Technical domain',
    'Graphical domain',
    'PR and Management domain',
    '3D Animation and VFX domain',
    'Parametric Modelling and Simulation domain'
  );

-- 4) Indexes.
--    `domain` becomes the authorization key in phase 2, so every policy there
--    filters on it. tasks(domain) and profiles(domain) carry those lookups.
--
--    Deliberately NOT added: a composite tasks(id, domain) index. Phase 2's
--    submissions policy joins on `t.id = submissions.task_id` and then compares
--    `t.domain`; `id` is already the primary key, so a composite would be
--    redundant. The existing primary-key index serves that join.
create index if not exists idx_profiles_domain on public.profiles(domain);
create index if not exists idx_tasks_domain    on public.tasks(domain);

-- 5) Report anything left unmapped. Informational only — nothing is broken by
--    these rows; they simply stay invisible to domain-scoped coordinators once
--    phase 2 lands, and need a human decision before then.
do $$
declare
  v_unmapped integer;
begin
  select count(*) into v_unmapped from public.tasks where domain is null;

  if v_unmapped > 0 then
    raise notice
      'domain-scoping phase 0: % task(s) have domain = null (no category mapping, e.g. ''General''). Assign or delete them before phase 2, which will hide them from every coordinator except the super-admin.',
      v_unmapped;
  end if;

  raise notice
    'domain-scoping phase 0 complete: % task(s) mapped, % profile(s) still without a domain (expected — set in phase 1/3).',
    (select count(*) from public.tasks where domain is not null),
    (select count(*) from public.profiles where domain is null);
end
$$;
