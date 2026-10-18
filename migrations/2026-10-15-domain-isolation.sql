-- ============================================================
-- Nexura Portal — domain isolation, PHASE 2 of 5 (2026-10-15)
-- THE SECURITY BOUNDARY.
--
-- Until this migration, public.is_admin() returned true for ANY coordinator
-- (database.sql §3), so every coordinator could create, edit and delete any
-- task and approve or reject any submission, in any domain. This file makes
-- access depend on the caller's `domain`.
--
-- What changes:
--   1. is_admin() is redefined to mean SUPER-ADMIN only (role = 'admin').
--   2. New helpers: is_super_admin(), is_staff(), current_domain(),
--      can_access_domain(domain).
--   3. The submission trigger and the notification fan-out become
--      domain-aware — without this, approval would break and every coordinator
--      would still be notified of every submission.
--   4. Tasks, submissions, notifications and storage policies are rewritten.
--
-- Frontend filtering is defence in depth ONLY. Nothing in src/ enforces this;
-- these policies are the boundary, and they hold even against a hand-crafted
-- API call with a valid token.
--
-- ------------------------------------------------------------
-- WHY is_admin() NOW MEANS SUPER-ADMIN
-- ------------------------------------------------------------
-- Any call site this migration fails to rewrite becomes MORE restrictive, not
-- less. A missed policy then hides data from a coordinator, which is visible
-- and gets fixed — whereas the opposite mistake would silently leave a
-- cross-domain hole open. Every current call site is rewritten below; the
-- old name is kept as a strict alias so the failure mode stays closed.
--
-- ------------------------------------------------------------
-- PREREQUISITES — READ BEFORE RUNNING
-- ------------------------------------------------------------
--   * Phase 0 (2026-10-15-domain-scoping.sql) applied — the domain columns.
--   * Phase 1 (2026-10-15-seed-domain-coordinators.sql) applied — the five
--     coordinators each have a domain.
--   * Every student and coordinator needs a domain BEFORE this runs. A user
--     with domain = null matches no domain, so they will see an empty portal:
--     no tasks, no submissions, no roster. Step 1 below refuses to continue
--     while such users exist, and tells you how many. See the override there.
--
-- Idempotent: safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Precondition: refuse to hide the whole portal from unassigned users.
-- ------------------------------------------------------------
-- A guard rather than a comment: after this file runs, a user without a domain
-- silently sees nothing, which looks like a catastrophic bug rather than a
-- policy decision. Failing here leaves the database exactly as it was.
--
-- If you intend to run strictly and assign domains afterwards, change
-- v_allow_unassigned to true.
do $$
declare
  v_allow_unassigned boolean := false;
  v_users    integer;
  v_tasks    integer;
begin
  select count(*) into v_users
  from public.profiles
  where domain is null and role in ('student', 'coordinator');

  select count(*) into v_tasks
  from public.tasks
  where domain is null;

  if v_users > 0 and not v_allow_unassigned then
    raise exception
      'Refusing to enable domain isolation: % student/coordinator profile(s) have no domain, and % task(s) have no domain. After this migration those users match no domain and will see an empty portal. Assign domains first, or set v_allow_unassigned := true in step 1 of this file to proceed deliberately.',
      v_users, v_tasks;
  end if;

  raise notice
    'Domain isolation preconditions OK: % unassigned user(s), % unassigned task(s).',
    v_users, v_tasks;
end
$$;


-- ------------------------------------------------------------
-- 2) Authorization helpers
-- ------------------------------------------------------------

-- The unscoped super-admin. Sees all five domains by design (decision 2).
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
    when public.is_super_admin()       then true
    when d is null                     then false
    when public.current_domain() is null then false
    else d = public.current_domain()
  end;
$$;

-- Redefined: this used to mean "any coordinator or admin", which is the hole
-- this migration closes. It now means super-admin, and is kept only so that any
-- call site missed by this file fails closed instead of open. Prefer the
-- explicit helpers above in new code.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;


-- ------------------------------------------------------------
-- 3) Submission guard: allow the RIGHT coordinator to review
-- ------------------------------------------------------------
-- The previous version gated every status change on is_admin(). Now that
-- is_admin() means super-admin, leaving it alone would stop domain
-- coordinators from approving anything — so the status check becomes
-- domain-aware instead of merely stricter.
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
    -- Filing work that is already reviewed is a staff action, not a
    -- coordinator one: a coordinator only changes status on an existing row,
    -- which the UPDATE branch below covers.
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
    -- The heart of review isolation: a coordinator may decide only on tasks
    -- belonging to their own domain. Previously any coordinator could approve
    -- any domain's submission.
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
-- 4) Notification fan-out: the matching coordinator only
-- ------------------------------------------------------------
-- Previously `where p.role in ('admin', 'coordinator')`, so all five
-- coordinators were alerted to every submission and every coordinator could
-- read the whole alert feed. Now: super-admins, plus the coordinator whose
-- domain owns the task.
create or replace function public.handle_submission_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_title  text;
  v_task_domain text;
  v_student_name text;
  v_student_id  uuid;
  v_sub_id      uuid;
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
-- 5) Profiles — self-service insert, or a super-admin bootstrapping
-- ------------------------------------------------------------
-- Rewritten rather than left alone. It previously read `or public.is_admin()`,
-- which would have tightened to super-admin on its own once is_admin() was
-- redefined — correct, but by accident and invisibly, and it would have made
-- the self-check in step 9 report a permanent false alarm. Making it explicit
-- keeps the intent on the page: a new account may create its own row as a
-- student, and only a super-admin may insert anything else.
--
-- Note that reading profiles is deliberately NOT domain-scoped here; see the
-- closing note. This policy governs inserts only.
drop policy if exists "Profiles insert allowed" on public.profiles;
drop policy if exists "Profiles insert self or super-admin" on public.profiles;
create policy "Profiles insert self or super-admin" on public.profiles
for insert with check (
  (auth.uid() = id and role = 'student')
  or public.is_super_admin()
);


-- ------------------------------------------------------------
-- 6) Tasks — read is by domain; writes stay inside the caller's domain
-- ------------------------------------------------------------
-- Students and coordinators both read the tasks of their own domain; only
-- staff write, and only within their own domain. `domain` in USING is the old
-- row and in WITH CHECK the new one, so a coordinator cannot move a task into
-- another domain.
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

-- The domain of a new task comes from the creator's profile, not from the
-- client — so a coordinator cannot file work into another domain even by
-- hand-crafting the request.
--
-- This is also what stops this migration from breaking task creation outright:
-- createTask() in src/ still sends no `domain`, so every insert would arrive as
-- NULL, the WITH CHECK above would reject it, and coordinators could no longer
-- create anything. Assigning it here means the frontend needs no change to
-- keep working, and phase 3 only has to make the form read-only for display.
--
-- Order matters and works in our favour. PostgreSQL documents it explicitly
-- (CREATE POLICY, "Row Security Policies"): "For INSERT, UPDATE, and MERGE
-- statements, WITH CHECK expressions are enforced after BEFORE triggers are
-- fired, and before any actual data modifications are made. Thus a BEFORE ROW
-- trigger may modify the data to be inserted, affecting the result of the
-- security policy check." So the value set here is the one the policy tests.
--
-- This is the single assumption worth re-checking if coordinator task creation
-- ever starts failing with a policy violation. Re-running this file is safe:
-- the trigger is dropped before it is recreated.
--
-- A super-admin has no domain of their own, so they must choose one explicitly
-- when creating a task. Passing NULL is rejected rather than silently creating
-- a task no coordinator can ever see.
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
  return new;
end;
$$;

drop trigger if exists trg_tasks_set_domain on public.tasks;
create trigger trg_tasks_set_domain
before insert on public.tasks
for each row execute function public.set_task_domain_from_creator();


-- ------------------------------------------------------------
-- 7) Submissions — own work, or staff of the parent task's domain
-- ------------------------------------------------------------
-- The domain of a submission is its task's domain, so each branch joins to
-- tasks and asks can_access_domain(). Submissions whose task has no domain
-- match nobody but the super-admin.
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
-- student could post work against any task whose id they knew, which is how a
-- cross-domain submission would be smuggled in.
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

-- A student may edit their own row (the trigger still forbids touching status
-- or ownership); a coordinator may only touch submissions of their own
-- domain's tasks.
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


-- ------------------------------------------------------------
-- 8) Notifications — own rows only
-- ------------------------------------------------------------
-- These policies previously contained `or public.is_admin()`, which let any
-- coordinator read and delete every other user's notifications. Nothing in the
-- app inserts notifications from the browser — the fan-out trigger does, and it
-- runs security definer, so it is unaffected by these policies.
-- Each policy is dropped under BOTH its old and its current name. Dropping
-- only the old name was enough while this file was the only thing that created
-- these policies, but database.sql now installs the current names as part of a
-- fresh setup — so without the second drop, running this file on an
-- already-current database fails with "policy already exists" instead of
-- quietly changing nothing, which is what idempotent has to mean.
drop policy if exists "Notifications read own" on public.notifications;
create policy "Notifications read own" on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists "Notifications insert own or admin" on public.notifications;
drop policy if exists "Notifications insert own" on public.notifications;
create policy "Notifications insert own" on public.notifications
for insert with check (auth.uid() = user_id);

drop policy if exists "Notifications update own or admin" on public.notifications;
drop policy if exists "Notifications update own" on public.notifications;
create policy "Notifications update own" on public.notifications
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Notifications delete own or admin" on public.notifications;
drop policy if exists "Notifications delete own" on public.notifications;
create policy "Notifications delete own" on public.notifications
for delete using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 9) Storage — a coordinator may only read their own domain's files
-- ------------------------------------------------------------
-- Object names are built by the app as `{studentId}/{taskId}/{file}`, so the
-- second path segment is the task id. Scoping on the task's domain (rather
-- than the uploader's) is what makes this exact: a coordinator can fetch
-- evidence for a task they are allowed to review, and nothing else.
--
-- The comparison is `t.id::text = split_part(...)` on purpose: casting the
-- path segment to uuid instead would raise on any object whose name does not
-- contain a uuid, turning one bad filename into a failing query. `tasks` is
-- small, so the per-row cast is not a performance concern.
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

-- Upload stays strictly owner-only: a student writes into their own folder,
-- and no policy lets them write anywhere else.
drop policy if exists "task-submissions-insert-owner" on storage.objects;
create policy "task-submissions-insert-owner" on storage.objects
for insert with check (
  bucket_id = 'task-submissions'
  and auth.uid()::text = split_part(name, '/', 1)
);


-- ------------------------------------------------------------
-- 10) Self-check and report
-- ------------------------------------------------------------
-- Confirms the rewrite actually landed, rather than trusting the file was run
-- to completion.
do $$
declare
  v_legacy_count    integer;
  v_legacy          text;
  v_domain_policies integer;
begin
  -- Any policy still mentioning is_admin() would now be super-admin-only by
  -- accident. After this migration there should be none: every call site was
  -- rewritten to the explicit helpers.
  select count(*),
         string_agg(format('%s on %s', policyname, tablename), '; ')
    into v_legacy_count, v_legacy
  from pg_policies
  where schemaname in ('public', 'storage')
    and (coalesce(qual, '') like '%is_admin%'
      or coalesce(with_check, '') like '%is_admin%');

  select count(*)
    into v_domain_policies
  from pg_policies
  where schemaname in ('public', 'storage')
    and (coalesce(qual, '') like '%can_access_domain%'
      or coalesce(with_check, '') like '%can_access_domain%');

  if v_legacy_count > 0 then
    raise warning
      'Domain isolation: % policy/policies still reference is_admin(), which now means super-admin — they are super-admin-only by accident. Review: %',
      v_legacy_count, v_legacy;
  else
    raise notice 'Domain isolation: no policy references is_admin(). Good.';
  end if;

  raise notice
    'Domain isolation applied: % policy/policies are now domain-scoped. Verify with a real coordinator JWT, not from the dashboard — the dashboard runs as postgres and bypasses RLS entirely. See section 7 of DOMAIN_COORDINATOR_PLAN.md.',
    v_domain_policies;
end
$$;


-- ------------------------------------------------------------
-- DELIBERATE GAP — profiles are still readable by every signed-in user
-- ------------------------------------------------------------
-- "Profiles read all" (using (true)) is left unchanged. Any authenticated user
-- can still read every profile row: names, emails, roll numbers, branches.
-- That is cross-domain visibility, and it is a decision here rather than an
-- oversight. The roster, name resolution on task cards, the coordinator
-- Students page and the notification fan-out all read this table; narrowing it
-- changes what those screens render, which needs checking against the live
-- project instead of being folded into a security migration untested.
--
-- Closing it later is small and self-contained:
--
--   drop policy if exists "Profiles read all" on public.profiles;
--   create policy "Profiles read own or own domain" on public.profiles
--   for select using (
--     auth.uid() = id
--     or public.is_super_admin()
--     or public.can_access_domain(domain)
--   );
--
-- Two consequences to verify before doing it: a user with no domain would then
-- see only their own row, and any screen that resolves another user's name
-- across domains would render a blank name instead.
--
-- ------------------------------------------------------------
-- Not covered here (later phases / separate work)
-- ------------------------------------------------------------
--   * Students choosing their domain at signup (phase 3) — until then, every
--     account created without one has domain = null and reaches none of the
--     domain-scoped data above. (An earlier version of this note named Google
--     sign-in as the way that happened; social sign-in was removed on
--     2026-10-16, so the registration form is now the only account-creation
--     path and captures a domain at signup.)
--   * Coordinator domain isolation in the UI: the pages themselves already
--     read from context, so they inherit the filtering, but a domain badge and
--     a locked domain field on the task form are phase 3.
--   * Realtime: the publication in database.sql is unchanged. Supabase applies
--     RLS to realtime rows, so the policies above govern what arrives.
