-- ============================================================
-- Nexura Portal — profiles contact columns (2026-10-08)
-- The portal reads and writes profiles.email, roll_no, branch and year,
-- but those columns never existed in the schema. Consequences fixed here:
--   * profiles.update({ name, email }) was rejected (400) and, because the
--     app did not check the returned error, toasted "Profile updated" anyway
--   * coordinator roster cards fell back to roll_no "N/A" with generic
--     branch/year, and student roll-number search matched nothing
-- Run in the Supabase SQL editor. Idempotent: safe to run more than once.
-- ============================================================

-- 1) Columns (nullable: existing rows are backfilled below).
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists roll_no text;
alter table public.profiles add column if not exists branch text;
alter table public.profiles add column if not exists year text;

create index if not exists idx_profiles_email on public.profiles(email);

-- 2) Backfill display email from auth (needs the postgres role — SQL editor).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;

-- 3) Keep profiles.email populated for every new signup. The trigger runs on
--    auth.users, where new.email is authoritative — never from client metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'student',
    new.email
  )
  on conflict (id) do update
    set name = excluded.name,
        email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;
