-- Jiihere — initial schema
-- Run this once in Supabase → SQL Editor → New query.
-- The schema mirrors src/domain/types.ts. Every table carries an
-- owner_id (auth.users.id) and is protected by RLS so a signed-in
-- teacher only ever sees their own rows.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type course_type as enum ('group', 'private');
create type course_status as enum ('active', 'archived');
create type session_status as enum ('scheduled', 'completed', 'cancelled');
create type attendance_status as enum ('present', 'absent', 'late', 'excused');
create type payment_method as enum (
  'cash', 'card', 'bank_transfer',
  'whish', 'omt', 'western_union', 'ltn',
  'other'
);
create type payment_status as enum ('paid', 'pending', 'failed', 'refunded');
create type currency as enum ('USD', 'EUR', 'GBP', 'SAR', 'AED');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  preferred_payment_method payment_method,
  notes text,
  created_at timestamptz not null default now()
);
create index students_owner_idx on public.students (owner_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type course_type not null,
  start_date date not null,
  end_date date not null,
  days text[] not null,               -- ['Mon','Wed',...]
  start_time text not null,           -- 'HH:MM'
  default_duration_min int not null,
  price_amount numeric(12,2) not null,
  price_currency currency not null,
  status course_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);
create index courses_owner_idx on public.courses (owner_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  is_paid boolean not null default false,
  registration_date date not null,
  payment_due_date date,              -- legacy single-due, still accepted
  installments jsonb,                 -- nullable; shape matches InstallmentPlan[]
  created_at timestamptz not null default now()
);
create index registrations_owner_idx on public.registrations (owner_id);
create index registrations_student_idx on public.registrations (student_id);
create index registrations_course_idx on public.registrations (course_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  amount numeric(12,2) not null,
  currency currency not null,
  method payment_method not null,
  status payment_status not null,
  paid_at date not null,
  note text,
  created_at timestamptz not null default now()
);
create index payments_owner_idx on public.payments (owner_id);
create index payments_registration_idx on public.payments (registration_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  date date not null,
  start_time text not null,           -- 'HH:MM'
  duration_min int not null,
  status session_status not null default 'scheduled',
  note text,
  created_at timestamptz not null default now()
);
create index sessions_owner_idx on public.sessions (owner_id);
create index sessions_course_idx on public.sessions (course_id);
create index sessions_date_idx on public.sessions (date);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status attendance_status not null,
  note text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index attendance_owner_idx on public.attendance (owner_id);
create index attendance_session_idx on public.attendance (session_id);
create index attendance_student_idx on public.attendance (student_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Policy: a signed-in user can SELECT/INSERT/UPDATE/DELETE only rows where
-- owner_id = auth.uid(). Enforced at the DB layer — no data leaks if the
-- client is compromised.
-- ---------------------------------------------------------------------------

alter table public.students       enable row level security;
alter table public.courses        enable row level security;
alter table public.registrations  enable row level security;
alter table public.payments       enable row level security;
alter table public.sessions       enable row level security;
alter table public.attendance     enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'courses', 'registrations',
    'payments', 'sessions', 'attendance'
  ]
  loop
    execute format('create policy %I_owner_select on public.%I for select using (owner_id = auth.uid())', t, t);
    execute format('create policy %I_owner_insert on public.%I for insert with check (owner_id = auth.uid())', t, t);
    execute format('create policy %I_owner_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
    execute format('create policy %I_owner_delete on public.%I for delete using (owner_id = auth.uid())', t, t);
  end loop;
end $$;
