-- Scam Check — initial schema
--
-- Two tables:
--   profiles  one row per auth user; plan + Stripe subscription state
--   checks    one row per check performed (used for the monthly free-tier count)
--
-- Privacy note: we deliberately do NOT store the pasted message. A `checks` row
-- records only the verdict, the kind of check, and (for URL checks) the domain.
-- People paste bank texts and personal messages in here; there is no reason for
-- us to keep them.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  email                  text,
  plan                   text        not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  subscription_status    text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.profiles is 'Plan + billing state, one row per user. Written by service-role code only.';

-- ---------------------------------------------------------------------------
-- checks
-- ---------------------------------------------------------------------------

create table if not exists public.checks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null default 'message' check (kind in ('message', 'url')),
  verdict    text        not null check (verdict in ('scam', 'uncertain', 'safe')),
  domain     text,
  created_at timestamptz not null default now()
);

create index if not exists checks_user_created_idx on public.checks (user_id, created_at desc);

comment on table public.checks is 'One row per completed check. Message content is never stored.';

-- ---------------------------------------------------------------------------
-- Free tier limit — single source of truth, read by SQL and by the edge function
-- ---------------------------------------------------------------------------

create or replace function public.free_monthly_limit()
returns integer
language sql
immutable
as $$ select 5 $$;

-- ---------------------------------------------------------------------------
-- Create a profile automatically for every new auth user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- current_usage() — everything the account page needs, in one round trip
-- ---------------------------------------------------------------------------

create or replace function public.current_usage()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  p             public.profiles%rowtype;
  period_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used          integer;
  lim           integer := public.free_monthly_limit();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into p from public.profiles where id = uid;

  select count(*) into used
  from public.checks
  where user_id = uid and created_at >= period_start;

  return json_build_object(
    'plan',                 coalesce(p.plan, 'free'),
    'used',                 used,
    'limit',                case when coalesce(p.plan, 'free') = 'pro' then null else lim end,
    'remaining',            case when coalesce(p.plan, 'free') = 'pro' then null else greatest(lim - used, 0) end,
    'period_start',         period_start,
    'subscription_status',  p.subscription_status,
    'cancel_at_period_end', coalesce(p.cancel_at_period_end, false),
    'current_period_end',   p.current_period_end
  );
end;
$$;

grant execute on function public.current_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Users may read their own rows and nothing else. All writes to profiles and
-- checks go through edge functions using the service role key, which bypasses
-- RLS — so there are deliberately no insert/update policies here.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.checks   enable row level security;

drop policy if exists "profiles are readable by their owner" on public.profiles;
create policy "profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "checks are readable by their owner" on public.checks;
create policy "checks are readable by their owner"
  on public.checks for select
  to authenticated
  using (auth.uid() = user_id);
