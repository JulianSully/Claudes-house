-- ============================================================================
-- AccessMap MVP — demo seed data
--
-- Intended for LOCAL DEVELOPMENT ONLY via the Supabase CLI:
--   supabase start
--   supabase db reset      -- runs migrations then this file automatically
--
-- The auth.users insert below relies on columns that only exist in the real
-- GoTrue schema that `supabase start` provisions locally (instance_id, aud,
-- role, encrypted_password, etc). Do NOT run this against a hosted/production
-- project — create real accounts via sign-up instead, then optionally adapt
-- the venues/reviews sections below (they have no dependency on demo users).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Demo users (password for all three: "password123")
-- The `handle_new_user` trigger from 0001_init.sql creates matching `profiles`
-- rows automatically.
-- ----------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'amara@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Amara (wheelchair user)"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'ben@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ben (low vision)"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'priya@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya (parent with pram)"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

update profiles set accessibility_needs = array['wheelchair', 'mobility']::accessibility_need[]
  where id = 'a0000000-0000-0000-0000-000000000001';
update profiles set accessibility_needs = array['visual']::accessibility_need[]
  where id = 'a0000000-0000-0000-0000-000000000002';
update profiles set accessibility_needs = array['other']::accessibility_need[]
  where id = 'a0000000-0000-0000-0000-000000000003';

-- ----------------------------------------------------------------------------
-- Venues — San Francisco, CA sample data across all categories
-- ----------------------------------------------------------------------------

insert into venues (id, name, category, description, address, latitude, longitude, phone, website) values
  ('b0000000-0000-0000-0000-000000000001', 'Ferry Building Marketplace', 'shop', 'Historic marketplace with local food vendors and shops.', '1 Ferry Building, San Francisco, CA', 37.7955, -122.3937, '415-555-0101', 'https://example.com/ferry-building'),
  ('b0000000-0000-0000-0000-000000000002', 'Golden Gate Park Cafe', 'cafe', 'Cozy cafe near the park entrance.', '501 Stanyan St, San Francisco, CA', 37.7694, -122.4862, '415-555-0102', null),
  ('b0000000-0000-0000-0000-000000000003', 'Bayview Bistro', 'restaurant', 'Farm-to-table dining with bay views.', '1200 3rd St, San Francisco, CA', 37.7580, -122.3888, '415-555-0103', 'https://example.com/bayview-bistro'),
  ('b0000000-0000-0000-0000-000000000004', 'Union Square Grand Hotel', 'hotel', 'Full-service hotel in the heart of downtown.', '333 Post St, San Francisco, CA', 37.7879, -122.4075, '415-555-0104', 'https://example.com/union-square-grand'),
  ('b0000000-0000-0000-0000-000000000005', 'de Young Museum', 'attraction', 'Fine arts museum in Golden Gate Park.', '50 Hagiwara Tea Garden Dr, San Francisco, CA', 37.7715, -122.4686, '415-555-0105', 'https://example.com/deyoung'),
  ('b0000000-0000-0000-0000-000000000006', 'Mission Dolores Coffee', 'cafe', 'Quiet neighborhood coffee shop.', '3300 16th St, San Francisco, CA', 37.7648, -122.4271, null, null),
  ('b0000000-0000-0000-0000-000000000007', 'Presidio Lodge', 'hotel', 'Boutique lodge near the Presidio.', '42 Moraga Ave, San Francisco, CA', 37.7989, -122.4662, '415-555-0107', null),
  ('b0000000-0000-0000-0000-000000000008', 'Chinatown Dim Sum House', 'restaurant', 'Traditional dim sum in the heart of Chinatown.', '855 Stockton St, San Francisco, CA', 37.7952, -122.4079, '415-555-0108', null),
  ('b0000000-0000-0000-0000-000000000009', 'Exploratorium', 'attraction', 'Interactive science museum on the waterfront.', 'Pier 15, San Francisco, CA', 37.8016, -122.3971, '415-555-0109', 'https://example.com/exploratorium'),
  ('b0000000-0000-0000-0000-00000000000a', 'Castro Books & Gifts', 'shop', 'Independent bookstore with a curated gift section.', '2275 Market St, San Francisco, CA', 37.7658, -122.4331, null, null),
  ('b0000000-0000-0000-0000-00000000000b', 'Sunset Family Diner', 'restaurant', 'Casual all-day breakfast diner.', '1200 Irving St, San Francisco, CA', 37.7639, -122.4736, '415-555-0111', null),
  ('b0000000-0000-0000-0000-00000000000c', 'Embarcadero Suites', 'hotel', 'Modern suites with bay views.', '1 Embarcadero Center, San Francisco, CA', 37.7952, -122.3979, '415-555-0112', null),
  ('b0000000-0000-0000-0000-00000000000d', 'California Academy of Sciences', 'attraction', 'Aquarium, planetarium, and natural history museum.', '55 Music Concourse Dr, San Francisco, CA', 37.7699, -122.4661, '415-555-0113', 'https://example.com/calacademy'),
  ('b0000000-0000-0000-0000-00000000000e', 'Noe Valley Pharmacy', 'shop', 'Neighborhood pharmacy and convenience shop.', '3868 24th St, San Francisco, CA', 37.7510, -122.4326, null, null);

-- ----------------------------------------------------------------------------
-- Reviews — structured accessibility answers from the three demo users
-- ----------------------------------------------------------------------------

insert into reviews (
  venue_id, user_id, overall_accessibility_rating, comment,
  step_free_entrance, ramp_available, automatic_doors, door_width_rating,
  accessible_parking, parking_distance_m,
  wheelchair_space, lift_available, seating_accessible,
  accessible_toilet, bathroom_rating,
  noise_level, lighting_level, quiet_periods_available, quiet_periods_notes,
  staff_helpfulness_rating
) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 5,
   'Wide open marketplace, easy to roll through with plenty of space between stalls.',
   true, true, true, 5, true, 20, true, false, true, true, 4, 'medium', 'bright', false, null, 5),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 4,
   'Great for prams too, just gets crowded at lunchtime.',
   true, true, true, 4, true, 25, true, false, true, true, 4, 'high', 'bright', false, null, 4),

  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 3,
   'Step at the entrance but staff bring a portable ramp if you ask.',
   false, true, false, 3, true, 60, true, false, true, true, 3, 'medium', 'moderate', true, 'Quietest before 6pm', 5),

  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 5,
   'Fully accessible rooms and a spacious lobby with automatic doors.',
   true, true, true, 5, true, 10, true, true, true, true, 5, 'low', 'bright', true, 'Lobby is calm most of the day', 5),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 4,
   'Good tactile signage in the elevators, staff were very helpful guiding me around.',
   true, true, true, 5, true, 10, true, true, true, true, 4, 'low', 'moderate', true, null, 5),

  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 4,
   'Audio guides available and wide galleries, some exhibits are dimly lit though.',
   true, true, true, 4, true, 30, true, true, true, true, 4, 'medium', 'dim', true, 'Weekday mornings are much quieter', 4),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 5,
   'Elevators to every floor, easy with a stroller.',
   true, true, true, 5, true, 30, true, true, true, true, 5, 'medium', 'bright', false, null, 5),

  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 2,
   'Narrow doorway and only one small table with clear space.',
   false, false, false, 2, false, null, false, false, false, true, 2, 'low', 'dim', true, 'Always quiet, low lighting can be hard to read menus though', 3),

  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 5,
   'Excellent step-free access throughout, one of the best in the city.',
   true, true, true, 5, true, 15, true, true, true, true, 5, 'high', 'bright', false, null, 5),
  ('b0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000003', 4,
   'Lots of room for strollers, gets loud near the rainforest dome.',
   true, true, true, 4, true, 20, true, true, true, true, 4, 'high', 'bright', true, 'First hour after opening is calmer', 4);

-- ----------------------------------------------------------------------------
-- A few likes, a verification confirmation, and a favorite for demo purposes
-- ----------------------------------------------------------------------------

insert into review_likes (review_id, user_id)
select id, 'a0000000-0000-0000-0000-000000000002' from reviews
where venue_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000001';

insert into verifications (venue_id, user_id) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003');

insert into favorites (user_id, venue_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009');
