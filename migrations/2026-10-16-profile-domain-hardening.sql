-- ============================================================
-- Nexura Portal — profile self-service, domain lock, and the limits of the
-- existing guards (2026-10-16)
--
-- Run this LAST, after every migration dated 2026-10-15.
--
-- Why it exists: three of the guards written earlier replace whole functions,
-- so they are the final word on those functions — and two of the things they
-- left open are real defects.
--
--   1. A student could move themselves to another domain.
--      `Profiles update self` is `auth.uid() = id`, and the profile guard only
--      protected `role` and `id`. So any student could run
--      `update profiles set domain = 'graphical'` and immediately read that
--      domain's tasks, submissions and files. The whole isolation model was
--      defeatable from a browser with one UPDATE.
--
--   2. A student could never resubmit after a rejection.
--      `submitTask()` sets `status = 'pending'` on the existing row, and the
--      submission guard raised on any status change by a non-staff caller. So
--      work sent back for changes could not be resubmitted at all, and the
--      'resubmitted' notification branch was unreachable.
--
-- It also closes a trap and adds what the app needs to let students maintain
-- their own details:
--
--   3. A task could be created with no domain. The domain trigger filled the
--      creator's domain but silently accepted NULL from a caller who has none
--      (a super-admin), producing a task no coordinator could ever see. It now
--      raises with an instruction instead.
--
--   4. Students can maintain their own profile: name, roll number, branch and
--      year. That needed no new policy — the existing one already allows a row
--      to be updated — but it needed the domain column to stop being part of
--      the same UPDATE, which is what (1) fixes. The policy is restated here
--      anyway, because a coordinator managing their own domain's roster is new
--      and useful: they can fix a student's details, and cannot hand a student
--      to another domain.
--
--   5. A student with no domain can claim one, once. That is how an account
--      created before the signup picker existed (or whose signup carried no
--      domain) gets one without an administrator running SQL. After that only
--      staff can change it. Neither a student nor a coordinator may CLEAR a set
--      domain — a user with no domain matches nothing and would silently lose
--      their whole portal — while the super-admin may, deliberately: that is the
--      escape hatch for unassigning someone, and it is reversible.
--
-- Idempotent: safe to re-run.
-- Prerequisites: the 2026-10-15 migrations. Running it on a database built from
-- database.sql is a no-op, because that file already contains everything here.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Schema additions
-- ------------------------------------------------------------
-- `profiles.updated_at` makes "when did this change" answerable, which the
-- roster needs once coordinators can edit it.
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Who filed a task. Audit only — never authorization. Filled by the trigger
-- below from the caller, so it cannot be spoofed by the payload.
alter table public.tasks add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_tasks_created_by on public.tasks(created_by);


-- ------------------------------------------------------------
-- 2) updated_at maintenance
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

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 3) The profile guard: the isolation boundary, enforced
-- ------------------------------------------------------------
-- Three things an account may not do to itself:
--   1. change its own role            (privilege escalation)
--   2. change its own id              (identity)
--   3. move itself to another domain  (the isolation boundary)  <-- new
--
-- Plus one thing it may do exactly once: claim a domain while it has none.
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
    if new.role <> 'student' and not v_is_super then
      raise exception 'New profiles must start with the student role';
    end if;
    -- Only enforce the id check when a user JWT is present: during signup
    -- auth.uid() is null and handle_new_user writes the row system-side.
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

-- The trigger already exists under this name (installed with the baseline);
-- recreated so this migration is self-sufficient on a database where it was
-- dropped for some reason.
drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
before insert or update on public.profiles
for each row execute function public.prevent_profile_role_escalation();


-- ------------------------------------------------------------
-- 4) Profiles: self-service, plus the coordinator's roster
-- ------------------------------------------------------------
-- The guard above decides which COLUMNS a self-service update may touch. This
-- policy decides which ROWS.
--
-- `can_access_domain(domain)` reads the OLD row in USING and the NEW row in
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


-- ------------------------------------------------------------
-- 5) Submissions: resubmission after a rejection
-- ------------------------------------------------------------
-- A student may reopen their OWN rejected row to 'pending'. Everything else
-- stays as the isolation migration left it: only the coordinator for the
-- task's domain may approve or reject.
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
    if new.status = 'pending'
       and old.status = 'rejected'
       and auth.uid() = old.student_id then
      return new;
    end if;

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


-- ------------------------------------------------------------
-- 6) Tasks: no orphan tasks, and record the author
-- ------------------------------------------------------------
-- Same as the isolation migration's version plus two things: the NULL check,
-- and stamping created_by from the caller.
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

drop trigger if exists trg_tasks_set_domain on public.tasks;
create trigger trg_tasks_set_domain
before insert on public.tasks
for each row execute function public.set_task_domain_from_creator();


-- ------------------------------------------------------------
-- 7) The submission fan-out, restated
-- ------------------------------------------------------------
-- Not changed by this migration — it is already domain-scoped — but it is
-- included so this file is the last word on every guard, not just three of
-- them. Re-running an OLDER migration after this one is the realistic mistake
-- (the 2026-09-05 file once fanned out to every coordinator), and a file that
-- ends with "all guards current" should be able to say that honestly.
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
           coalesce(v_student_name, 'A student') || ' submitted "'
             || coalesce(v_task_title, 'a task') || '" for review',
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
             coalesce(v_student_name, 'A student') || ' resubmitted "'
               || coalesce(v_task_title, 'a task') || '"',
             '/coordinator/submissions/' || v_sub_id
      from public.profiles p
      where p.role = 'admin'
         or (p.role = 'coordinator' and p.domain = v_task_domain);
    end if;
    if new.status = 'approved' and old.status is distinct from 'approved' then
      insert into public.notifications (user_id, type, title, message, link)
      values (v_student_id, 'approved', 'Submission approved',
              'Your submission for "' || coalesce(v_task_title, 'a task')
                || '" was approved'
                || case when new.feedback is not null and new.feedback <> ''
                        then ' — "' || new.feedback || '"' else '' end || '.',
              '/student/submissions/' || v_sub_id);
    end if;
    if new.status = 'rejected' and old.status is distinct from 'rejected' then
      insert into public.notifications (user_id, type, title, message, link)
      values (v_student_id, 'rejected', 'Changes requested',
              'Your submission for "' || coalesce(v_task_title, 'a task')
                || '" was sent back with feedback'
                || case when new.feedback is not null and new.feedback <> ''
                        then ': "' || new.feedback || '"' else '' end || '.',
              '/student/submissions/' || v_sub_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.notifications (user_id, type, title, message, link)
    values (v_student_id, 'removed', 'Submission removed',
            'Your submission for "' || coalesce(v_task_title, 'a task')
              || '" was removed.',
            '/student/tasks');
    return old;
  end if;

  return null;
end;
$$;


-- ------------------------------------------------------------
-- 8) Self-check and report
-- ------------------------------------------------------------
-- This migration is the last word on these functions, so it verifies that it
-- really was. A failure here rolls the whole file back and names the object
-- that is still wrong.
do $$
declare
  v_missing text[] := array[]::text[];
  v_domain_lock boolean;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'created_by'
  ) then
    v_missing := v_missing || 'tasks.created_by';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_at'
  ) then
    v_missing := v_missing || 'profiles.updated_at';
  end if;

  -- The new triggers must be present AND enabled: a guard that exists but is
  -- disabled is exactly the state the 2026-10-15 seed works hard to prove it
  -- has avoided.
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname = 'profiles' and t.tgname = 'trg_profiles_role_guard' and t.tgenabled = 'O'
  ) then
    v_missing := v_missing || 'trg_profiles_role_guard (enabled)';
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname = 'tasks' and t.tgname = 'trg_tasks_set_domain' and t.tgenabled = 'O'
  ) then
    v_missing := v_missing || 'trg_tasks_set_domain (enabled)';
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'Hardening incomplete: missing %', array_to_string(v_missing, ', ');
  end if;

  -- Prove the domain lock is in the installed function body, not just in this
  -- file's intent. If a later rerun of an older migration replaced it again,
  -- this catches that on the spot.
  select prosrc like '%cannot be changed here%'
    into v_domain_lock
  from pg_proc
  where proname = 'prevent_profile_role_escalation'
  limit 1;

  if not coalesce(v_domain_lock, false) then
    raise exception
      'Hardening incomplete: prevent_profile_role_escalation() does not contain the domain lock. An older migration was likely run after this one — re-run this file.';
  end if;

  -- Same reasoning for the fan-out: a coordinator should be alerted about their
  -- own domain only, and an older migration re-run afterwards would restore the
  -- every-coordinator broadcast.
  if not exists (
    select 1 from pg_proc
    where proname = 'handle_submission_notifications'
      and prosrc like '%p.domain = v_task_domain%'
  ) then
    raise exception
      'Hardening incomplete: handle_submission_notifications() does not target the matching coordinator. Re-run this file.';
  end if;

  raise notice
    'Profile/domain hardening applied: domain is locked after signup (one-time claim only), students may maintain their own details, their coordinator may maintain the roster, rejected work can be resubmitted, and a task can no longer be created without a domain.';
end
$$;
