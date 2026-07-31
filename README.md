# AccessMap

A mobile-first accessibility discovery app — find, rate and verify places you can
confidently visit.

Google Maps tells you a venue has "a wheelchair accessible entrance". AccessMap tells
you how wide the door is, whether the lift works, how loud it gets at 7pm, and that
eighteen people confirmed it in the last ninety days.

See **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** for the architecture, schema rationale and
milestones.

---

## Stack

React Native (Expo) · Supabase (Postgres + Auth + Storage + Edge Functions) · Stripe ·
OpenAI · Google Maps

## Layout

```
supabase/
  migrations/0001_init.sql   schema, views, RLS policies
  seed.sql                   demo venues, reviews, users (local dev only)
  functions/
    ai-assistant/            OpenAI, grounded in real venue data
    create-checkout-session/ Stripe Checkout
    stripe-webhook/          subscription state → is_premium
app/
  src/screens/               auth, onboarding, map, venue, review, assistant, paywall, profile
  src/components/            UI primitives, venue card, review item, map
  src/lib/                   supabase client, venue queries + personalised ranking
  src/context/               auth + profile state
```

---

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then apply the schema — either
paste `supabase/migrations/0001_init.sql` into the SQL editor, or:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For local development with the seed data:

```bash
supabase start
supabase db reset      # runs the migration, then seed.sql
```

> `seed.sql` inserts demo users directly into `auth.users` and only works against a
> local `supabase start` stack. Against a hosted project, sign up normally instead.
> Demo logins: `amara@example.com` / `ben@example.com` / `priya@example.com`,
> password `password123`.

Create a **public** Storage bucket named `review-photos` for user-uploaded images.

### 2. App

```bash
cd app
npm install
cp .env.example .env     # fill in your Supabase URL + anon key
npm start                # then press i / a, or scan the QR code
```

The anon key is safe to ship in a client app — RLS is what protects the data.

For maps on device, add Google Maps API keys to `app.json` under
`ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey`.

### 3. Edge functions

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_PRICE_ID=price_...        # the $14.99/mo recurring price
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

supabase functions deploy ai-assistant
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

`stripe-webhook` **must** be deployed with `--no-verify-jwt` — Stripe calls it directly,
not on behalf of a signed-in user. It verifies Stripe's signature instead. Point a
Stripe webhook endpoint at it, subscribing to `checkout.session.completed`,
`customer.subscription.updated` and `customer.subscription.deleted`.

---

## How it works

**Accessibility facts live on reviews, not venues.** Each venue's public profile is
aggregated from its reviews: boolean facts take the majority answer, ratings are
averaged, and anything nobody has reported shows as "Not reported" rather than "No".
A single incorrect report can't flip a venue's profile, and the data can't go stale
behind an un-updated column.

**Verification is one tap.** Confirming a venue is still accurate is deliberately
cheaper than writing a review, which is what makes *"Verified by 18 people in the last
90 days"* achievable rather than aspirational.

**Ranking is personal.** Your stated needs reweight results — step-free entrances and
accessible toilets for a wheelchair user, low noise and quiet periods for someone with
sensory sensitivities. Unreviewed venues rank last but are never hidden; otherwise they
could never get their first review.

**Contributing is always free.** Premium sells convenience — advanced filters,
favourites, offline, the AI assistant. It never sells access to the community's data.

---

## Development

```bash
cd app
npm run typecheck        # tsc --strict, zero errors expected
npm run ios | android | web
```

`react-native-maps` has no web build, so the Map tab falls back to the list view on
web (`VenueMap.tsx` vs `VenueMap.native.tsx`, resolved by Metro's platform extensions).

Accessibility is treated as a correctness requirement, not a polish pass: interactive
targets are ≥44pt, controls carry explicit roles/labels/states, decorative icons are
hidden from assistive tech, and each accessibility fact is announced as a single
"label: value" unit.

## Status

Schema, RLS, and every screen have been verified by execution — the migration and seed
data applied to a live PostgreSQL 16 instance, RLS confirmed to block cross-user writes,
and the full signed-in flow driven in a real browser with no console errors.

Stripe, OpenAI and native maps are written but unverified, as each needs live
third-party credentials. See PROJECT_PLAN.md §7.
