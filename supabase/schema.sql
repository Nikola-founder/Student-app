-- ============================================================================
-- BOARDING STUDENT PWA — DATABASE SCHEMA (Supabase / PostgreSQL)
-- ============================================================================
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query).
-- Assumes Supabase Auth is enabled (auth.users table exists by default).
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type event_category as enum ('academics', 'social', 'personal', 'dorm', 'travel');
create type timezone_context as enum ('home', 'host');
create type expense_category as enum ('food', 'transit', 'school_supplies', 'social', 'other');
create type currency_context as enum ('home', 'host');

-- ============================================================================
-- BOARDING HOUSES (lookup table — shared across all users)
-- ============================================================================
create table public.boarding_houses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PROFILES (1:1 extension of auth.users)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  grade_level text,               -- e.g. "10th Grade", "Year 12"
  primary_language text,
  home_country text,
  host_country text,
  home_timezone text not null default 'UTC',   -- IANA tz, e.g. 'Asia/Seoul'
  host_timezone text not null default 'UTC',   -- IANA tz, e.g. 'America/New_York'
  boarding_house_id uuid references public.boarding_houses(id) on delete set null,
  room_number text,
  monthly_budget_limit numeric(10,2),
  budget_currency currency_context not null default 'host',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- EVENTS  (Calendar module: events + reminders share this table)
-- ============================================================================
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  category event_category not null default 'personal',
  color text not null default '#6366F1',       -- hex, defaults per category client-side
  timezone_context timezone_context not null default 'host', -- which tz the user entered it in
  is_reminder boolean not null default false,
  is_all_day boolean not null default false,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_time >= start_time)
);

create index idx_events_user_start on public.events (user_id, start_time);

-- ============================================================================
-- WELLNESS LOGS  (Wellness & AI Journal module)
-- ============================================================================
create table public.wellness_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  mood_score smallint not null check (mood_score between 1 and 5), -- 1=very low .. 5=great
  mood_tags text[] not null default '{}',       -- e.g. {"Homesick","Stressed"}
  journal_entry text,                            -- "what's on my mind" thought dump
  ai_reflection text,                             -- 2-3 sentence AI-generated reflection
  ai_reflection_model text,                       -- which model generated it, for auditing
  ai_reflection_generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)                      -- one entry per user per day
);

create index idx_wellness_user_date on public.wellness_logs (user_id, log_date desc);

-- Weekly AI-generated emotion trend summaries (cached so we don't regenerate on every view)
create table public.weekly_emotion_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,                       -- Monday of the summarized week
  summary text not null,
  dominant_moods text[] not null default '{}',
  avg_mood_score numeric(3,2),
  generated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ============================================================================
-- EXPENSES  (Finance & Budgeting module)
-- ============================================================================
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category expense_category not null default 'other',
  amount numeric(10,2) not null check (amount >= 0),
  currency_code text not null,                    -- ISO 4217, e.g. 'USD', 'KRW'
  currency_context currency_context not null default 'host',
  amount_in_home_currency numeric(10,2),           -- converted snapshot at time of entry
  exchange_rate_used numeric(12,6),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_expenses_user_date on public.expenses (user_id, expense_date desc);

-- ============================================================================
-- CONTACTS  (Social & Dorm Directory module)
-- ============================================================================
create table public.contacts (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade, -- whose address book
  name text not null,
  country_of_origin text,
  phone text,
  social_handle text,                             -- e.g. "@handle" or "Instagram: ..."
  room_number text,
  grade_level text,
  primary_language text,
  boarding_house_id uuid references public.boarding_houses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_owner on public.contacts (owner_id);
create index idx_contacts_house on public.contacts (boarding_house_id);

-- ============================================================================
-- ROW LEVEL SECURITY — every user only ever sees their own rows
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.wellness_logs enable row level security;
alter table public.weekly_emotion_summaries enable row level security;
alter table public.expenses enable row level security;
alter table public.contacts enable row level security;
alter table public.boarding_houses enable row level security;

-- profiles: user can read/update only their own row
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- events
create policy "events_all_own" on public.events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- wellness_logs
create policy "wellness_all_own" on public.wellness_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- weekly_emotion_summaries
create policy "weekly_summary_all_own" on public.weekly_emotion_summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- expenses
create policy "expenses_all_own" on public.expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- contacts (address book is private to its owner)
create policy "contacts_all_own" on public.contacts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- boarding_houses: readable by any authenticated user (shared lookup list),
-- but not writable by regular users (manage via Supabase dashboard or an admin role)
create policy "boarding_houses_select_all" on public.boarding_houses
  for select using (auth.role() = 'authenticated');

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New Student'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- SEED DATA (example boarding houses — edit to match your school)
-- ============================================================================
insert into public.boarding_houses (name, description) values
  ('Churchill House', 'Main international dorm, grades 9-10'),
  ('Windsor House', 'Senior dorm, grades 11-12'),
  ('Kensington House', 'Mixed-grade international house');
