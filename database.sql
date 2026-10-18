-- ============================================================
-- Nexura Portal — full database setup
--
-- This file is the CURRENT design, not a historical baseline. Running it on an
-- empty project produces the system the app expects: five club domains with
-- per-domain isolation enforced in the database.
--
-- It used to be a two-layer story — install this file, then run five migrations
-- from migrations/ in order to turn isolation on. That was a trap: the file
-- alone left `is_admin()` meaning "any coordinator", `Tasks read all` readable
-- by everyone, and no trigger assigning a task's domain, so a fresh install
-- silently ran with no isolation at all while LOOKING complete. Everything
-- those migrations added has been folded in here. The files in migrations/ are
-- for databases installed before each change and are not needed on a fresh
-- install (they are idempotent, so running them afterwards changes nothing).
--
-- Domain model, in one place:
--   * Decision 1 (2026-10-15) — a student chooses their domain at signup.
--   * Decision 2 — one unscoped super-admin (`role = 'admin'`, domain null)
--     sees all five domains. Everyone else is scoped.
--   * A coordinator can only ever touch their own domain's data.
--   * A task's domain comes from its creator's profile, never from the client,
--     and a task can never be created without one.
--   * A student may claim a domain once if they have none; after that it is
--     staff-controlled, so nobody can walk into another domain's work.
--
-- Idempotent: safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Extensions
-- ------------------------------------------------------------
create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- 2) Tables
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'student' check (role in ('student', 'admin', 'coordinator')),
  -- Display/contact fields the portal renders on profile and roster cards.
  -- profiles.email is a display copy kept in sync with auth.users.email by
  -- handle_new_user; auth.users is the authoritative identity. The rest are
  -- free text the student (or staff, for their domain's roster) maintains.
  email text,
  roll_no text,
  branch text,
  year text,
  -- Club domain slug: 'technical', 'graphical', 'pr_management',
  -- 'animation_vfx', 'parametric'. Nullable by design — a student picks one at
  -- signup (or claims one from their profile if they signed up without one) and
  -- a coordinator is assigned one. See src/lib/domains.js for the labels these
  -- slugs map to.
  --
  -- The constraint is NAMED to match migrations/2026-10-15-domain-scoping.sql.
  -- An unnamed inline check would become "profiles_domain_check", the migration
  -- would not find that name, and a fresh database would end up with two
  -- identical constraints.
  domain text,
  constraint profiles_domain_valid check (
    domain is null or domain in (
      'technical', 'graphical', 'pr_management', 'animation_vfx', 'parametric'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the table's first release, for databases installed before
-- them. `add column if not exists` is a no-op when the CREATE TABLE above
-- already made them, which is what keeps this file runnable on both.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists roll_no text;
alter table public.profiles add column if not exists branch text;
alter table public.profiles add column if not exists year text;
alter table public.profiles add column if not exists domain text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  difficulty text not null default 'Medium',
  requirements text[] not null default '{}',
  assigned_to uuid[] not null default '{}',
  deadline timestamptz not null check (deadline > now()),
  points integer not null default 10 check (points >= 0),
  -- Same five slugs as profiles.domain, and named to match
  -- migrations/2026-10-15-domain-scoping.sql for the same reason. Nullable at
  -- the table level because rows predating the column have no mapping; the
  -- trigger in section 5 refuses to leave a NEW row null, so the app can never
  -- create an orphan task that no coordinator can see.
  domain text,
  constraint tasks_domain_valid check (
    domain is null or domain in (
      'technical', 'graphical', 'pr_management', 'animation_vfx', 'parametric'
    )
  ),
  -- Who filed the task. Filled by the trigger from the caller, so it cannot be
  -- spoofed; used for audit rather than authorization.
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists domain text;
alter table public.tasks add column if not exists created_by uuid references public.profiles(id) on delete set null;

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_url text,
  github_url text,
  live_url text,
  notes text,
  feedback text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  attempt integer not null default 1,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, task_id, attempt)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info'
    check (type in ('approved', 'rejected', 'submitted', 'resubmitted', 'removed', 'task', 'reminder', 'pending', 'info')),
  title text not null,
  message text not null default '',
  link text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) Authorization helpers
-- ------------------------------------------------------------
-- The isolation model rests on these five functions. They are `security
-- definer` so they can read profiles without being filtered by the very
-- policies that call them — otherwise a policy on profiles that selects from
-- profiles would recurse.

-- The unscoped super-admin (decision 2). Sees all five domains by design.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- Any member of staff: a domain coordinator or a super-admin. Used where the
-- question is "is this a staff action at all?", before asking which domain.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'coordinator')
  );
$$;

-- Kept so that any call site not rewritten to the helpers above fails CLOSED
-- rather than open. It means super-admin now, not "any coordinator" — the
-- meaning it had before domain isolation existed. Prefer the explicit helpers
-- in new code.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

-- The caller's own domain, or null when they have none (or are not signed in).
create or replace function public.current_domain()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.domain from public.profiles p where p.id = auth.uid();
$$;

-- May the caller act on rows belonging to domain `d`?
--
-- Written as an explicit CASE so the result is never NULL: `d = NULL` yields
-- NULL, and a NULL policy expression is treated as false but reads as a bug
-- waiting to happen. A super-admin passes unconditionally; everyone else needs
-- a non-null domain on both sides.
create or replace function public.can_access_domain(d text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin()         then true
    when d is null                       then false
    when public.current_domain() is null then false
    else d = public.current_domain()
  end;
$$;


-- ------------------------------------------------------------
-- 4) Timestamps
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Kept under its original name: the migrations and existing databases
-- reference it.
create or replace function public.set_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 5) Guards, fan-out and domain assignment
-- ------------------------------------------------------------

-- Signup. This is the only writer of a new account's domain, and it is the
-- reason the signup picker is not cosmetic: the browser cannot write
-- profiles.domain directly (that column decides what the account may read), so
-- the choice arrives as Supabase user metadata and is persisted here.
--
-- The value is client-supplied, so it is treated as untrusted: only one of the
-- five known slugs is stored. Anything else is discarded rather than passed to
-- the CHECK constraint, which would abort the whole signup and leave the user
-- with no profile at all.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
begin
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

-- Profile guard: the three things an account may not do to itself.
--
--   1. change its own role            (privilege escalation)
--   2. change its own id              (identity)
--   3. move itself to another domain  (the isolation boundary)
--
-- Rule 3 is the one that matters for domain isolation. Without it the
-- `Profiles update self or staff` policy is enough to let any student run
-- `update profiles set domain = 'graphical'` and immediately read that domain's
-- tasks, submissions and files — the whole model defeated from the client.
--
-- A student may still CLAIM a domain once while theirs is null: that is how the
-- signup picker's choice is honoured for an account that arrived without one,
-- and how an account created before the picker existed gets a domain. After
-- that only staff can change it, and only into a domain they can reach
-- themselves. Nobody may clear a domain that is set, because a user with no
-- domain matches nothing and would silently lose their entire portal.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean := public.is_super_admin();
  v_is_staff boolean := public.is_staff();
begin
  if tg_op = 'INSERT' then
    if new.role is null then
      new.role := 'student';
    end if;
    if new.role not in ('student', 'admin', 'coordinator') then
      raise exception 'Invalid role';
    end if;
    -- New accounts are always students; only a super-admin may bootstrap a
    -- coordinator/admin profile directly.
    if new.role <> 'student' and not v_is_super then
      raise exception 'New profiles must start with the student role';
    end if;
    -- Only enforce the id check when a user JWT is present (auth.uid() is null
    -- during signup, where this trigger runs system-side through
    -- handle_new_user instead).
    if auth.uid() is not null
       and new.id is distinct from auth.uid()
       and not v_is_super then
      raise exception 'Profile creation is restricted to authenticated users';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id and not v_is_super then
    raise exception 'Profile identity cannot be changed';
  end if;

  if new.role is distinct from old.role and not v_is_super then
    raise exception 'Role escalation is forbidden';
  end if;

  if new.domain is distinct from old.domain then
    if v_is_super then
      null; -- the super-admin may assign any domain
    elsif v_is_staff then
      if new.domain is null then
        raise exception 'A domain cannot be cleared once set';
      end if;
      if not public.can_access_domain(new.domain) then
        raise exception 'You can only assign students to your own domain';
      end if;
    elsif old.domain is null and new.domain is not null then
      null; -- one-time self-claim
    else
      raise exception
        'Your domain is set by the club and cannot be changed here. Ask a coordinator if it is wrong.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_submission_ownership_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.student_id is null then
      raise exception 'student_id is required';
    end if;
    if new.student_id <> auth.uid() and not public.is_super_admin() then
      raise exception 'Students can only submit their own work';
    end if;
    if new.status is null then
      new.status := 'pending';
    end if;
    -- Filing work that is already reviewed is a staff action: a coordinator
    -- only changes status on an existing row, which the UPDATE branch covers.
    if new.status <> 'pending' and not public.is_super_admin() then
      raise exception 'Only a super-admin may file a submission as already reviewed';
    end if;
    return new;
  end if;

  if new.student_id is distinct from old.student_id
     and not public.is_super_admin() then
    raise exception 'Submission ownership cannot be reassigned';
  end if;

  if new.status is distinct from old.status then
    -- 1. A student re-opening their OWN rejected work for another attempt.
    --    Without this branch resubmission is impossible: submitTask() sets
    --    status = 'pending' on the existing row, and the old guard raised on
    --    any status change by a non-staff caller — so a student whose work was
    --    sent back got an error instead of a resubmission, and the
    --    'resubmitted' notification below could never fire.
    if new.status = 'pending'
       and old.status = 'rejected'
       and auth.uid() = old.student_id then
      return new;
    end if;

    -- 2. Otherwise only the coordinator for this task's domain may decide,
    --    and only that transition. This is the heart of review isolation.
    if not (
      public.is_super_admin()
      or (public.is_staff() and exists (
            select 1 from public.tasks t
            where t.id = new.task_id
              and public.can_access_domain(t.domain)
          ))
    ) then
      raise exception
        'Only the coordinator for this task''s domain may approve or reject it';
    end if;
  end if;

  return new;
end;
$$;

-- A new task's domain comes from its creator's profile, not from the client, so
-- a coordinator cannot file work into another domain even by hand-crafting the
-- request.
--
-- Order matters and works in our favour. PostgreSQL documents it (CREATE
-- POLICY, "Row Security Policies"): "For INSERT, UPDATE, and MERGE statements,
-- WITH CHECK expressions are enforced after BEFORE triggers are fired... Thus a
-- BEFORE ROW trigger may modify the data to be inserted, affecting the result of
-- the security policy check." So the value set here is the one the policy tests.
--
-- The final check is what stops an orphan: a caller with no domain of their own
-- (a super-admin) passing NULL used to create a task that NO coordinator could
-- ever see, silently. It now fails with something a person can act on.
create or replace function public.set_task_domain_from_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.domain is null then
    new.domain := public.current_domain();
  end if;

  if new.domain is null then
    raise exception
      'A task must belong to one of the five club domains, and your account has no domain to take it from. Choose a domain on the form.';
  end if;

  -- Audit only. Never trusted from the payload.
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

-- Auto-notify users when submission state changes (insert/update/delete).
--
-- The fan-out targets the matching coordinator only. It previously selected
-- `p.role in ('admin', 'coordinator')`, so all five coordinators were alerted to
-- every submission and any of them could read the whole alert feed.
create or replace function public.handle_submission_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_title   text;
  v_task_domain  text;
  v_student_name text;
  v_student_id   uuid;
  v_sub_id       uuid;
begin
  v_student_id := coalesce(new.student_id, old.student_id);
  v_sub_id     := coalesce(new.id, old.id);

  select t.title, t.domain
    into v_task_title, v_task_domain
  from public.tasks t
  where t.id = coalesce(new.task_id, old.task_id);

  select name into v_student_name from public.profiles where id = v_student_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, type, title, message, link)
    select p.id, 'submitted', 'New submission',
           coalesce(v_student_name, 'A student') || ' submitted "' || coalesce(v_task_title, 'a task') || '" for review',
           '/coordinator/submissions/' || v_sub_id
    from public.profiles p
    where p.role = 'admin'
       or (p.role = 'coordinator' and p.domain = v_task_domain);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'pending' and old.status is distinct from 'pending' then
      insert into public.notifications (user_id, type, title, message, link)
      select p.id, 'resubmitted', 'Resubmission received',
             coalesce(v_student_name, 'A student') || ' resubmitted "' || coalesce(v_task_title, 'a task') || '"',
             '/coordinator/submissions/' || v_sub_id
      from public.profiles p
      where p.role = 'admin'
         or (p.role = 'coordinator' and p.domain = v_task_domain);
    end if;
    if new.status = 'approved' and old.status is distinct from 'approved' then
      insert into public.notifications (user_id, type, title, message, link)
      values (v_student_id, 'approved', 'Submission approved',
              'Your submission for "' || coalesce(v_task_title, 'a task') || '" was approved'
              || case when new.feedback is not null and new.feedback <> ''
                      then ' — "' || new.feedback || '"' else '' end || '.',
              '/student/submissions/' || v_sub_id);
    end if;
    if new.status = 'rejected' and old.status is distinct from 'rejected' then
      insert into public.notifications (user_id, type, title, message, link)
      values (v_student_id, 'rejected', 'Changes requested',
              'Your submission for "' || coalesce(v_task_title, 'a task') || '" was sent back with feedback'
              || case when new.feedback is not null and new.feedback <> ''
                      then ': "' || new.feedback || '"' else '' end || '.',
              '/student/submissions/' || v_sub_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.notifications (user_id, type, title, message, link)
    values (v_student_id, 'removed', 'Submission removed',
            'Your submission for "' || coalesce(v_task_title, 'a task') || '" was removed.',
            '/student/tasks');
    return old;
  end if;

  return null;
end;
$$;

-- ------------------------------------------------------------
-- 6) Triggers
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
before insert or update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_set_domain on public.tasks;
create trigger trg_tasks_set_domain
before insert on public.tasks
for each row execute function public.set_task_domain_from_creator();

drop trigger if exists trg_submissions_guard on public.submissions;
create trigger trg_submissions_guard
before insert or update on public.submissions
for each row execute function public.prevent_submission_ownership_changes();

drop trigger if exists trg_submissions_set_updated_at on public.submissions;
create trigger trg_submissions_set_updated_at
before update on public.submissions
for each row
execute function public.set_submissions_updated_at();

drop trigger if exists trg_submission_notifications on public.submissions;
create trigger trg_submission_notifications
after insert or update or delete on public.submissions
for each row execute function public.handle_submission_notifications();-- ------------------------------------------------------------
-- 7) Row Level Security
-- ------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.tasks         enable row level security;
alter table public.submissions   enable row level security;
alter table public.notifications enable row level security;

-- Profiles — read narrowly, written narrowly.
--
-- Reading WAS `using (true)` on the theory that the domain column itself is
-- not secret — but the club rejected that: it handed every authenticated
-- account (and the anon key) the whole member directory, so the technical
-- coordinator could list graphical students and every roster, count and name
-- lookup answered from the same unscoped table. Reading is now domain-scoped
-- to match tasks and submissions: your own row, every row of your own domain
-- (what the Students page, the CreateTask roster and submission name
-- resolution read), everything for the super-admin. The client scopes its
-- roster too (AppContext.syncLiveData), so the UI is correct even before this
-- policy runs — but this file is what actually stops the API returning rows
-- the caller must not see.
drop policy if exists "Profiles read all" on public.profiles;
drop policy if exists "Profiles read own or own domain" on public.profiles;
create policy "Profiles read own or own domain" on public.profiles
for select using (
  auth.uid() = id
  or public.is_super_admin()
  or public.can_access_domain(domain)
);

drop policy if exists "Profiles insert allowed" on public.profiles;
drop policy if exists "Profiles insert self or super-admin" on public.profiles;
create policy "Profiles insert self or super-admin" on public.profiles
for insert with check (
  (auth.uid() = id and role = 'student')
  or public.is_super_admin()
);

-- A student edits their own row — the guard trigger decides which COLUMNS may
-- actually change — and staff edit students they are responsible for. The
-- `can_access_domain(domain)` test reads the OLD row in USING and the NEW row in
-- WITH CHECK, so a coordinator can update a student of their own domain and
-- cannot hand a student to another domain.
drop policy if exists "Profiles update self" on public.profiles;
drop policy if exists "Profiles update self or staff" on public.profiles;
create policy "Profiles update self or staff" on public.profiles
for update
using (
  auth.uid() = id
  or public.is_super_admin()
  or (public.is_staff() and public.can_access_domain(domain))
)
with check (
  auth.uid() = id
  or public.is_super_admin()
  or (public.is_staff() and public.can_access_domain(domain))
);

-- Tasks — read and written by domain. `domain` in USING is the old row and in
-- WITH CHECK the new one, so a coordinator cannot move a task into another
-- domain either.
drop policy if exists "Tasks read all" on public.tasks;
drop policy if exists "Tasks read by domain" on public.tasks;
create policy "Tasks read by domain" on public.tasks for select
using (public.can_access_domain(domain));

drop policy if exists "Tasks insert admin" on public.tasks;
drop policy if exists "Tasks insert own domain" on public.tasks;
create policy "Tasks insert own domain" on public.tasks for insert
with check (
  public.is_staff() and public.can_access_domain(domain)
);

drop policy if exists "Tasks update admin" on public.tasks;
drop policy if exists "Tasks update own domain" on public.tasks;
create policy "Tasks update own domain" on public.tasks
for update
using (public.is_staff() and public.can_access_domain(domain))
with check (public.is_staff() and public.can_access_domain(domain));

drop policy if exists "Tasks delete admin" on public.tasks;
drop policy if exists "Tasks delete own domain" on public.tasks;
create policy "Tasks delete own domain" on public.tasks for delete
using (public.is_staff() and public.can_access_domain(domain));

-- Submissions — a student's own work, or staff of the parent task's domain.
-- A submission's domain is its task's domain, so every branch joins to tasks.
-- A submission whose task has no domain matches nobody but the super-admin.
drop policy if exists "Submissions read own or admin" on public.submissions;
drop policy if exists "Submissions read own or own domain" on public.submissions;
create policy "Submissions read own or own domain" on public.submissions
for select using (
  auth.uid() = student_id
  or public.is_super_admin()
  or (public.is_staff() and exists (
        select 1 from public.tasks t
        where t.id = submissions.task_id
          and public.can_access_domain(t.domain)
      ))
);

-- Students file against a task in their own domain. Without the task check a
-- student could post work against any task whose id they knew.
drop policy if exists "Submissions insert self or admin" on public.submissions;
drop policy if exists "Submissions insert self own domain" on public.submissions;
create policy "Submissions insert self own domain" on public.submissions
for insert with check (
  public.is_super_admin()
  or (
    auth.uid() = student_id
    and status = 'pending'
    and exists (
      select 1 from public.tasks t
      where t.id = submissions.task_id
        and t.domain is not null
        and t.domain = public.current_domain()
    )
  )
);

drop policy if exists "Submissions update self or admin" on public.submissions;
drop policy if exists "Submissions update own or own domain" on public.submissions;
create policy "Submissions update own or own domain" on public.submissions
for update
using (
  auth.uid() = student_id
  or public.is_super_admin()
  or (public.is_staff() and exists (
        select 1 from public.tasks t
        where t.id = submissions.task_id
          and public.can_access_domain(t.domain)
      ))
)
with check (
  auth.uid() = student_id
  or public.is_super_admin()
  or (public.is_staff() and exists (
        select 1 from public.tasks t
        where t.id = submissions.task_id
          and public.can_access_domain(t.domain)
      ))
);

drop policy if exists "Submissions delete self or admin" on public.submissions;
drop policy if exists "Submissions delete own or own domain" on public.submissions;
create policy "Submissions delete own or own domain" on public.submissions
for delete using (
  auth.uid() = student_id
  or public.is_super_admin()
  or (public.is_staff() and exists (
        select 1 from public.tasks t
        where t.id = submissions.task_id
          and public.can_access_domain(t.domain)
      ))
);

drop policy if exists "Notifications read own" on public.notifications;
create policy "Notifications read own" on public.notifications
for select using (auth.uid() = user_id);

-- Nothing in the app inserts notifications from the browser; the fan-out
-- trigger above does, and it runs security definer, so it is unaffected by these
-- policies. The previous versions contained `or public.is_admin()`, which let
-- any coordinator read and delete every other user's notifications.
drop policy if exists "Notifications insert own or admin" on public.notifications;
create policy "Notifications insert own" on public.notifications
for insert with check (auth.uid() = user_id);

drop policy if exists "Notifications update own or admin" on public.notifications;
create policy "Notifications update own" on public.notifications
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Notifications delete own or admin" on public.notifications;
create policy "Notifications delete own" on public.notifications
for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 8) Indexes
-- ------------------------------------------------------------
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_domain on public.profiles(domain);
create index if not exists idx_tasks_deadline on public.tasks(deadline);
create index if not exists idx_tasks_category on public.tasks(category);
-- domain is the authorization key every policy filters on.
create index if not exists idx_tasks_domain on public.tasks(domain);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_submissions_student_task on public.submissions(student_id, task_id);
create index if not exists idx_submissions_status on public.submissions(status);
create index if not exists idx_submissions_created_at on public.submissions(created_at);
create index if not exists idx_notifications_user_time on public.notifications (user_id, created_at desc);

-- ------------------------------------------------------------
-- 9) App access permissions
-- ------------------------------------------------------------
-- RLS decides WHICH rows; these grants decide whether the role may touch the
-- table at all. Both are needed: without a grant the client sees "permission
-- denied" instead of an empty, correctly-filtered result.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.tasks, public.submissions to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant insert, update, delete on public.tasks, public.submissions to authenticated;
grant update on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 10) Realtime
-- ------------------------------------------------------------
-- Only create if not exists, to preserve existing subscriptions. Supabase
-- applies RLS to realtime rows, so the policies above govern what arrives.
do $$
begin
  create publication supabase_realtime for table public.profiles, public.tasks, public.submissions, public.notifications;
exception when others then
  null; -- Publication may already exist; ignore the error.
end
$$;

-- ------------------------------------------------------------
-- 11) Storage
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('task-submissions', 'task-submissions', false)
on conflict (id) do update set public = false;

-- Object names are built by the app as `{studentId}/{taskId}/{file}`, so the
-- second path segment is the task id. Scoping on the task's domain (rather than
-- the uploader's) is what makes this exact: a coordinator can fetch evidence for
-- a task they are allowed to review, and nothing else.
--
-- The comparison is `t.id::text = split_part(...)` on purpose: casting the path
-- segment to uuid instead would raise on any object whose name does not contain
-- a uuid, turning one bad filename into a failing query. `tasks` is small, so
-- the per-row cast is not a performance concern.
drop policy if exists "task-submissions-read-own-admin" on storage.objects;
drop policy if exists "task-submissions-read-own-domain" on storage.objects;
create policy "task-submissions-read-own-domain" on storage.objects
for select using (
  bucket_id = 'task-submissions' and (
    auth.uid()::text = split_part(name, '/', 1)
    or public.is_super_admin()
    or (public.is_staff() and exists (
          select 1 from public.tasks t
          where t.id::text = split_part(name, '/', 2)
            and public.can_access_domain(t.domain)
        ))
  )
);

drop policy if exists "task-submissions-update-own-admin" on storage.objects;
drop policy if exists "task-submissions-update-own-domain" on storage.objects;
create policy "task-submissions-update-own-domain" on storage.objects
for update using (
  bucket_id = 'task-submissions' and (
    auth.uid()::text = split_part(name, '/', 1)
    or public.is_super_admin()
    or (public.is_staff() and exists (
          select 1 from public.tasks t
          where t.id::text = split_part(name, '/', 2)
            and public.can_access_domain(t.domain)
        ))
  )
)
with check (
  bucket_id = 'task-submissions' and (
    auth.uid()::text = split_part(name, '/', 1)
    or public.is_super_admin()
    or (public.is_staff() and exists (
          select 1 from public.tasks t
          where t.id::text = split_part(name, '/', 2)
            and public.can_access_domain(t.domain)
        ))
  )
);

drop policy if exists "task-submissions-delete-own-admin" on storage.objects;
drop policy if exists "task-submissions-delete-own-domain" on storage.objects;
create policy "task-submissions-delete-own-domain" on storage.objects
for delete using (
  bucket_id = 'task-submissions' and (
    auth.uid()::text = split_part(name, '/', 1)
    or public.is_super_admin()
    or (public.is_staff() and exists (
          select 1 from public.tasks t
          where t.id::text = split_part(name, '/', 2)
            and public.can_access_domain(t.domain)
        ))
  )
);

-- Upload stays strictly owner-only: a student writes into their own folder, and
-- no policy lets them write anywhere else.
drop policy if exists "task-submissions-insert-owner" on storage.objects;
create policy "task-submissions-insert-owner" on storage.objects
for insert with check (
  bucket_id = 'task-submissions'
  and auth.uid()::text = split_part(name, '/', 1)
);


-- ------------------------------------------------------------
-- 12) Self-check
-- ------------------------------------------------------------
-- Confirms the install actually landed rather than trusting that the file ran to
-- completion. It RAISES on failure — a database that looks installed but is not
-- isolated is the exact failure mode this file exists to prevent.
do $$
declare
  v_unscoped integer;
  v_problem  text;
begin
  select count(*), string_agg(format('%s on %s', policyname, tablename), '; ')
    into v_unscoped, v_problem
  from pg_policies
  where schemaname = 'public'
    and tablename in ('tasks', 'submissions', 'notifications')
    and coalesce(qual::text, '') || coalesce(with_check::text, '') like '%is_admin()%';

  if v_unscoped > 0 then
    raise exception
      'Install incomplete: % policy/policies still authorize through is_admin(), which no longer means "any coordinator": %. Re-run this file.',
      v_unscoped, v_problem;
  end if;

  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles', 'tasks', 'submissions', 'notifications')
      and not c.relrowsecurity
  ) then
    raise exception 'Install incomplete: row level security is off on at least one table.';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'tasks' and t.tgname = 'trg_tasks_set_domain' and t.tgenabled = 'O'
  ) then
    raise exception 'Install incomplete: the task-domain trigger is missing or disabled.';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'profiles' and t.tgname = 'trg_profiles_role_guard' and t.tgenabled = 'O'
  ) then
    raise exception 'Install incomplete: the profile guard is missing or disabled.';
  end if;

  raise notice
    'Nexura install OK: domain isolation active on tasks, submissions, notifications and storage; guards enabled.';
end
$$;