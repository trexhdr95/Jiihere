-- Jiihere — admin + invite-only gate (migration 0002)
--
-- Adds:
--   * public.profiles  — one row per signed-in user, with is_admin flag
--   * public.invites   — admin-managed allowlist of emails
--   * is_admin()       — SECURITY DEFINER helper (avoids RLS recursion)
--   * ensure_profile() — called by the app right after sign-in; either
--                        creates the user's profile (if first user, or
--                        invited) or raises 'not_invited'.
--
-- Run this in the Supabase SQL Editor after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_is_admin_idx on public.profiles (is_admin) where is_admin;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted boolean not null default false,
  accepted_at timestamptz
);
create index invites_email_idx on public.invites (lower(email));

-- ---------------------------------------------------------------------------
-- is_admin() — read admin-ness of the currently-signed-in user WITHOUT
-- triggering RLS recursion on profiles. Used inside RLS policies below.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS on profiles
--   * Users can read their own profile.
--   * Admins can read/write all profiles.
--   * ensure_profile() (below, SECURITY DEFINER) is the only path that
--     inserts a new profile — the client has no direct insert permission.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (user_id = auth.uid());

create policy profiles_admin_all
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS on invites
--   * Admins can do everything.
--   * Everyone else: nothing (reads happen via check_invite() or
--     ensure_profile(), both SECURITY DEFINER).
-- ---------------------------------------------------------------------------

alter table public.invites enable row level security;

create policy invites_admin_all
  on public.invites for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ensure_profile() — the invite gate.
-- Called by the app once per sign-in. Returns the user's profile row, or
-- raises `not_invited` if the user has no existing profile AND their email
-- isn't on a pending invite. Bootstraps the very first user as admin.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.profiles;
  user_email text;
  is_first boolean;
  invite_id uuid;
begin
  -- Early-exit if the user already has a profile.
  select * into existing from public.profiles where user_id = auth.uid();
  if found then
    return existing;
  end if;

  -- Look up the user's verified email from the auth schema.
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    raise exception 'no_email_on_auth_user';
  end if;

  -- Bootstrap: first-ever profile becomes admin automatically.
  select count(*) = 0 into is_first from public.profiles;

  if not is_first then
    -- Second+ user: require a matching pending invite.
    select id into invite_id
      from public.invites
      where lower(email) = lower(user_email)
        and not accepted
      limit 1;
    if invite_id is null then
      raise exception 'not_invited';
    end if;
  end if;

  -- Create the profile.
  insert into public.profiles (user_id, email, is_admin)
  values (auth.uid(), user_email, is_first)
  returning * into existing;

  -- Mark the invite accepted, if there was one.
  if invite_id is not null then
    update public.invites
    set accepted = true, accepted_at = now()
    where id = invite_id;
  end if;

  return existing;
end $$;
revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;
