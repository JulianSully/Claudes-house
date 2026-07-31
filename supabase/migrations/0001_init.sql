-- ============================================================================
-- AccessMap MVP — initial schema
-- Target: Supabase (Postgres 15+). Relies on the built-in `auth.users` table
-- and `auth.uid()` helper that Supabase provides.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type accessibility_need as enum (
  'wheelchair',
  'mobility',
  'visual',
  'hearing',
  'sensory',
  'other'
);

create type venue_category as enum (
  'restaurant',
  'cafe',
  'hotel',
  'shop',
  'attraction',
  'other'
);

create type sensory_level as enum ('low', 'medium', 'high');
create type lighting_level as enum ('dim', 'moderate', 'bright');

-- Mirrors the full set of Stripe subscription statuses so webhook events
-- can never fail to write because of an unmapped enum value.
create type subscription_status as enum (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

-- ----------------------------------------------------------------------------
-- profiles — one row per auth.users row, created by trigger on signup
-- ----------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  accessibility_needs accessibility_need[] not null default '{}',
  is_premium boolean not null default false,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Public user profile + accessibility preferences, 1:1 with auth.users.';

-- ----------------------------------------------------------------------------
-- businesses — future-ready: lets a business claim & manage a venue listing
-- ----------------------------------------------------------------------------

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles (id) on delete set null,
  name text not null,
  contact_email text,
  is_premium boolean not null default false,
  stripe_customer_id text unique,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table businesses is 'Business accounts that can later claim venues and pay for premium listings.';

-- ----------------------------------------------------------------------------
-- venues
-- ----------------------------------------------------------------------------

create table venues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses (id) on delete set null,
  claimed boolean not null default false,
  name text not null,
  category venue_category not null default 'other',
  description text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  phone text,
  website text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index venues_category_idx on venues (category);
-- Simple bounding-box friendly indexes for MVP map queries (no PostGIS needed yet).
create index venues_lat_idx on venues (latitude);
create index venues_lng_idx on venues (longitude);

comment on table venues is 'Base venue records (restaurants, hotels, shops, attractions, etc).';

-- ----------------------------------------------------------------------------
-- reviews — structured accessibility answers + free-text comment
-- ----------------------------------------------------------------------------

create table reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,

  overall_accessibility_rating smallint not null check (overall_accessibility_rating between 1 and 5),
  comment text,

  -- Entrance
  step_free_entrance boolean,
  ramp_available boolean,
  automatic_doors boolean,
  door_width_rating smallint check (door_width_rating between 1 and 5),

  -- Parking
  accessible_parking boolean,
  parking_distance_m integer,

  -- Inside
  wheelchair_space boolean,
  lift_available boolean,
  seating_accessible boolean,

  -- Bathroom
  accessible_toilet boolean,
  bathroom_rating smallint check (bathroom_rating between 1 and 5),

  -- Sensory
  noise_level sensory_level,
  lighting_level lighting_level,
  quiet_periods_available boolean,
  quiet_periods_notes text,

  -- Other
  staff_helpfulness_rating smallint check (staff_helpfulness_rating between 1 and 5),

  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (venue_id, user_id)
);

create index reviews_venue_idx on reviews (venue_id);
create index reviews_user_idx on reviews (user_id);
create index reviews_created_at_idx on reviews (created_at desc);

comment on table reviews is 'One structured accessibility review per user per venue (edits update in place).';

-- ----------------------------------------------------------------------------
-- review_photos
-- ----------------------------------------------------------------------------

create table review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index review_photos_review_idx on review_photos (review_id);

-- ----------------------------------------------------------------------------
-- review_likes
-- ----------------------------------------------------------------------------

create table review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

-- ----------------------------------------------------------------------------
-- review_reports
-- ----------------------------------------------------------------------------

create table review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete cascade,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);

-- ----------------------------------------------------------------------------
-- verifications — lightweight "this is still accurate" confirmations,
-- separate from full reviews, used for the trust/verification badge.
-- ----------------------------------------------------------------------------

create table verifications (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index verifications_venue_idx on verifications (venue_id);
create index verifications_created_at_idx on verifications (created_at desc);

comment on table verifications is 'Quick "still accurate" confirmations. Combined with reviews for the verification badge.';

-- ----------------------------------------------------------------------------
-- favorites — premium "save favourite places"
-- ----------------------------------------------------------------------------

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, venue_id)
);

-- ----------------------------------------------------------------------------
-- subscriptions — Stripe-backed premium membership
-- ----------------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status subscription_status,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ai_messages — history for the AI accessibility assistant
-- ----------------------------------------------------------------------------

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_messages_user_idx on ai_messages (user_id, created_at);

-- ============================================================================
-- Derived views — the crowd-sourced accessibility profile & trust signals.
-- Kept as views (not tables) so they can never go stale; can be materialized
-- later if aggregation cost becomes a problem at scale.
-- ============================================================================

create view venue_accessibility_summary with (security_invoker = true) as
select
  v.id as venue_id,
  count(r.id)::int as review_count,
  round(avg(r.overall_accessibility_rating)::numeric, 1) as accessibility_score,

  (mode() within group (order by r.step_free_entrance)) as step_free_entrance,
  (mode() within group (order by r.ramp_available)) as ramp_available,
  (mode() within group (order by r.automatic_doors)) as automatic_doors,
  round(avg(r.door_width_rating)::numeric, 1) as door_width_rating,

  (mode() within group (order by r.accessible_parking)) as accessible_parking,
  round(avg(r.parking_distance_m)::numeric, 0) as parking_distance_m,

  (mode() within group (order by r.wheelchair_space)) as wheelchair_space,
  (mode() within group (order by r.lift_available)) as lift_available,
  (mode() within group (order by r.seating_accessible)) as seating_accessible,

  (mode() within group (order by r.accessible_toilet)) as accessible_toilet,
  round(avg(r.bathroom_rating)::numeric, 1) as bathroom_rating,

  (mode() within group (order by r.noise_level)) as noise_level,
  (mode() within group (order by r.lighting_level)) as lighting_level,
  (mode() within group (order by r.quiet_periods_available)) as quiet_periods_available,

  round(avg(r.staff_helpfulness_rating)::numeric, 1) as staff_helpfulness_rating,

  max(r.created_at) as last_reviewed_at
from venues v
left join reviews r on r.venue_id = v.id
group by v.id;

comment on view venue_accessibility_summary is 'Crowd-sourced accessibility profile aggregated from all reviews for a venue.';

create view venue_verification_summary with (security_invoker = true) as
select
  v.id as venue_id,
  greatest(
    coalesce(max(r.created_at), 'epoch'::timestamptz),
    coalesce(max(ver.created_at), 'epoch'::timestamptz)
  ) as last_verified_at,
  count(distinct u.user_id) filter (where u.created_at > now() - interval '90 days') as confirmations_last_90_days
from venues v
left join reviews r on r.venue_id = v.id
left join verifications ver on ver.venue_id = v.id
left join lateral (
  select r2.user_id, r2.created_at from reviews r2 where r2.venue_id = v.id
  union all
  select ver2.user_id, ver2.created_at from verifications ver2 where ver2.venue_id = v.id
) u on true
group by v.id;

comment on view venue_verification_summary is 'Trust signal: "Accessibility verified by N users in the last 90 days."';

-- ============================================================================
-- Functions & triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger venues_set_updated_at before update on venues
  for each row execute function set_updated_at();
create trigger reviews_set_updated_at before update on reviews
  for each row execute function set_updated_at();
create trigger businesses_set_updated_at before update on businesses
  for each row execute function set_updated_at();
create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new Supabase auth user signs up.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table profiles enable row level security;
alter table businesses enable row level security;
alter table venues enable row level security;
alter table reviews enable row level security;
alter table review_photos enable row level security;
alter table review_likes enable row level security;
alter table review_reports enable row level security;
alter table verifications enable row level security;
alter table favorites enable row level security;
alter table subscriptions enable row level security;
alter table ai_messages enable row level security;

-- profiles: readable by anyone (needed for review author display), only owner can write
create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users can update own profile" on profiles for update using (auth.uid() = id);
create policy "users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- businesses: public read, owner-only write
create policy "businesses are publicly readable" on businesses for select using (true);
create policy "owners manage their business" on businesses for update using (auth.uid() = owner_id);
create policy "authenticated users can create a business" on businesses for insert with check (auth.uid() = owner_id);

-- venues: public read, authenticated create, creator or business owner can update
create policy "venues are publicly readable" on venues for select using (true);
create policy "authenticated users can add venues" on venues for insert with check (auth.uid() is not null);
create policy "creator or business owner can update venue" on venues for update using (
  auth.uid() = created_by
  or auth.uid() in (select owner_id from businesses where businesses.id = venues.business_id)
);

-- reviews: public read, authenticated users manage their own
create policy "reviews are publicly readable" on reviews for select using (true);
create policy "users can create their own review" on reviews for insert with check (auth.uid() = user_id);
create policy "users can update their own review" on reviews for update using (auth.uid() = user_id);
create policy "users can delete their own review" on reviews for delete using (auth.uid() = user_id);

-- review_photos: public read, only the review's author can attach/remove
create policy "review photos are publicly readable" on review_photos for select using (true);
create policy "review author can add photos" on review_photos for insert with check (
  auth.uid() in (select user_id from reviews where reviews.id = review_photos.review_id)
);
create policy "review author can delete photos" on review_photos for delete using (
  auth.uid() in (select user_id from reviews where reviews.id = review_photos.review_id)
);

-- review_likes: public read, authenticated users manage their own like
create policy "review likes are publicly readable" on review_likes for select using (true);
create policy "users can like reviews" on review_likes for insert with check (auth.uid() = user_id);
create policy "users can remove their like" on review_likes for delete using (auth.uid() = user_id);

-- review_reports: reporter can create/read their own; not publicly readable
create policy "users can view their own reports" on review_reports for select using (auth.uid() = reporter_id);
create policy "users can report a review" on review_reports for insert with check (auth.uid() = reporter_id);

-- verifications: public read, authenticated users can confirm
create policy "verifications are publicly readable" on verifications for select using (true);
create policy "users can verify a venue" on verifications for insert with check (auth.uid() = user_id);

-- favorites: private to the owning user
create policy "users can view their own favorites" on favorites for select using (auth.uid() = user_id);
create policy "users can add favorites" on favorites for insert with check (auth.uid() = user_id);
create policy "users can remove favorites" on favorites for delete using (auth.uid() = user_id);

-- subscriptions: private to the owning user; only backend (service role) writes
create policy "users can view their own subscription" on subscriptions for select using (auth.uid() = user_id);

-- ai_messages: private to the owning user
create policy "users can view their own ai messages" on ai_messages for select using (auth.uid() = user_id);
create policy "users can insert their own ai messages" on ai_messages for insert with check (auth.uid() = user_id);
