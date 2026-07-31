# AccessMap — Project Plan

**"Google Maps for accessibility."** A mobile-first app where people with disabilities
find, rate and verify places they can confidently visit.

---

## 1. The problem, stated precisely

Accessibility information today fails in three specific ways:

1. **Binary and shallow.** Google Maps offers "wheelchair accessible entrance: yes".
   That single bit doesn't answer the questions that decide whether a trip is possible:
   how wide is the door, is there a lift to the first floor, is the accessible toilet
   actually in service, how loud does it get at 7pm.
2. **Unverifiable and stale.** A venue installs a ramp, or a listing is wrong from the
   start, and nothing corrects it. Users can't tell whether a claim was checked
   yesterday or in 2019.
3. **Not personalised.** "Accessible" means different things to a wheelchair user, a
   blind user, and an autistic user seeking a low-sensory room. One global flag serves
   none of them well.

**Design consequence:** the product is not a directory with an accessibility field
bolted on. It is a *structured, timestamped, community-verified* dataset, queried
through the lens of each user's stated needs. Every architectural decision below
follows from that.

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────┐
│  React Native (Expo) — iOS · Android · web fallback   │
│  auth · map/list · venue profile · review · assistant │
└──────────────┬────────────────────────┬───────────────┘
               │ supabase-js (JWT)      │ functions.invoke()
               ▼                        ▼
┌──────────────────────────┐  ┌────────────────────────────┐
│  Supabase managed layer  │  │  Edge Functions (Deno)     │
│  • Auth (GoTrue)         │  │  • ai-assistant  → OpenAI  │
│  • PostgREST API         │  │  • create-checkout-session │
│  • Storage (photos)      │  │  • stripe-webhook          │
└────────────┬─────────────┘  └─────────────┬──────────────┘
             │                              │ service role
             ▼                              ▼
┌───────────────────────────────────────────────────────┐
│  PostgreSQL — tables · views · RLS policies           │
└───────────────────────────────────────────────────────┘
```

### Why this shape

**The client talks to the database directly, through RLS.** Supabase exposes
PostgREST over the tables; row-level security policies are the authorisation layer.
This removes an entire CRUD backend tier we would otherwise write and maintain — for an
MVP that is the single biggest scope saving available, and the security properties are
*stronger* than hand-rolled route guards because they're enforced in the database
regardless of how the row is reached.

**Edge functions exist only where a secret or a trust boundary requires them.**
Three cases, no more:
- `ai-assistant` — the OpenAI key must never reach the client.
- `create-checkout-session` — the Stripe secret key, likewise.
- `stripe-webhook` — must write `is_premium` while bypassing RLS, and must verify a
  Stripe signature. It is the *only* thing permitted to grant premium; the client can
  never mark itself premium, because no RLS policy allows a user to update that column.

**Aggregates are views, not columns.** A venue's accessibility profile is derived from
its reviews (see §3). Storing it denormalised would require every write path to
recompute it and would silently drift the first time one path forgot. As a view it
cannot go stale. When aggregation cost becomes real, the view becomes a materialised
view refreshed on a schedule — a one-line change, invisible to the client.

**Bounding-box geo instead of PostGIS.** Map queries filter on indexed `latitude` /
`longitude` ranges. PostGIS is the right answer at scale, but it is a migration we can
make later without changing the client's query shape. Not needed to test the idea.

---

## 3. Database schema

### The central modelling decision

**Accessibility facts live on reviews, not on venues.** A venue does not have a
`step_free_entrance` column. Instead every review carries the full structured
questionnaire, and the venue's public profile is the *aggregate* of those reviews,
exposed through `venue_accessibility_summary`.

This is the schema expressing the product thesis. It gives us, for free:

- **Trust through consensus.** Boolean facts aggregate via `mode()` — the majority
  answer wins, so a single wrong or malicious report cannot flip a venue's profile.
  Ratings aggregate via `avg()`.
- **Honest gaps.** A field nobody has answered aggregates to `NULL`, and the app renders
  "Not reported" rather than implying "No". Absence of data and a negative answer are
  genuinely different things to someone planning a trip, and the schema keeps them
  distinct.
- **Recency, inherently.** Every fact is attached to a dated review, so "last verified"
  is a real query, not a field someone has to remember to update.
- **A path for business claims.** When a business later claims a listing, its statements
  become another input to the aggregate — not an override of lived experience.

### Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | 1:1 with `auth.users` | `accessibility_needs[]` drives personalisation; `is_premium` written only by the Stripe webhook |
| `businesses` | Future business accounts | Present in the MVP schema so claiming a listing later needs no migration of existing rows |
| `venues` | Base venue record | Deliberately holds *no* accessibility columns |
| `reviews` | The structured questionnaire | `unique (venue_id, user_id)` — one review per person per venue, edited in place via upsert |
| `review_photos` | User photos | Path into Supabase Storage |
| `review_likes` | "This was helpful" | `unique (review_id, user_id)` |
| `review_reports` | Inaccuracy reports | Only visible to the reporter and staff |
| `verifications` | Lightweight "still accurate" taps | Separate from reviews so confirming costs one tap, not a full form — this is what makes the 90-day trust signal achievable |
| `favorites` | Saved places (premium) | Private to the user |
| `subscriptions` | Mirror of Stripe state | Written only by the webhook |
| `ai_messages` | Assistant history | Private to the user |

### Views

- **`venue_accessibility_summary`** — review count, average accessibility score, and the
  consensus value of every structured field.
- **`venue_verification_summary`** — `last_verified_at` and
  `confirmations_last_90_days`, combining reviews *and* verifications. This is what
  renders as *"Verified by 18 people in the last 90 days."*

Both are declared `security_invoker = true`, so the querying user's RLS applies to the
underlying tables rather than the view owner's — without this, a view is a hole in RLS.

### Enums

`accessibility_need`, `venue_category`, `sensory_level` (low/medium/high),
`lighting_level` (dim/moderate/bright), `subscription_status`.

`lighting_level` is deliberately separate from `sensory_level`: "high lighting" is
ambiguous where "bright" is not, and the two axes are read by different users for
different reasons. `subscription_status` mirrors Stripe's full status set so an
unexpected webhook value can never fail to write.

### Row-level security

RLS is on for all eleven tables. The shape:

- Public data (venues, reviews, likes, verifications, profiles) is world-readable —
  browsing must work before sign-up.
- Writes are restricted to `auth.uid() = user_id`.
- Private data (favourites, subscriptions, AI messages, reports) is readable only by its
  owner.
- `subscriptions` has **no** insert/update policy at all: only the service-role webhook
  writes it.

Verified against a live PostgreSQL instance, including a cross-user write attempt as a
non-superuser role, which RLS correctly blocked.

---

## 4. Personalisation

`personalisedScore()` ranks venues against the user's stated needs — a wheelchair user
gets step-free entrances, ramps and accessible toilets weighted up; a sensory-sensitive
user gets low noise and quiet periods weighted up. Recently-confirmed venues get a small
boost.

Venues with no reviews sort to the bottom but are **never hidden**. Hiding them would
make the empty set permanent: nobody sees the venue, so nobody reviews it. They appear
with an explicit invitation to be the first reviewer.

---

## 5. Free vs premium

| | Free | Premium ($14.99/mo) |
|---|---|---|
| Browse, search, read reviews | ✅ | ✅ |
| Leave reviews, verify venues | ✅ | ✅ |
| Basic filters (step-free, accessible toilet) | ✅ | ✅ |
| Advanced filters (parking, lift, quiet periods) | — | ✅ |
| Personalised recommendations | — | ✅ |
| Save favourites · trip planning · offline | — | ✅ |
| AI assistant | — | ✅ |

**Contributing is free, permanently.** Paywalling reviews or verifications would starve
the dataset the whole product depends on. Premium sells convenience over a public good,
not access to it.

---

## 6. Milestones

| # | Milestone | Scope | Status |
|---|---|---|---|
| 1 | **Data foundation** | Schema, enums, views, RLS, seed data | ✅ Applied and tested against live Postgres |
| 2 | **Accounts** | Signup/login, auto-provisioned profile, needs onboarding | ✅ Verified in browser |
| 3 | **Discovery** | Map + list, search, filters, personalised ranking | ✅ Verified in browser |
| 4 | **Venue profiles** | Full accessibility profile, verification badge | ✅ Verified in browser |
| 5 | **Contribution** | Structured review form, likes, reports, verify | ✅ Form verified; photo upload deferred |
| 6 | **Monetisation** | Stripe checkout + webhook, premium gating | ✅ Gating verified; needs live Stripe keys |
| 7 | **AI assistant** | Edge function grounded in venue data | ✅ Written; needs live OpenAI key |
| 8 | **Business profiles** | Claim flow, business dashboard | ⏭ Schema ready, UI deferred |

### Deliberately deferred

Photo upload UI (schema and storage policy are ready), trip planning, offline caching,
push notifications, the business-facing dashboard, moderation tooling, and PostGIS. Each
is a real feature; none is needed to test whether people will contribute and rely on
this data.

---

## 7. What was verified, and what wasn't

**Verified by execution:**
- The migration applies cleanly to PostgreSQL 16; seed data loads; views return correct
  aggregates.
- RLS blocks cross-user writes when acting as a non-superuser role.
- The app compiles under `tsc --strict` with zero errors across all source files.
- The app **runs**: signup screen, sign-in, venue list with personalised ordering, full
  venue profile, review form, assistant gate, profile, and paywall were each driven in a
  real browser against the real schema, with zero console errors.

**Not verified — requires live third-party credentials:**
- Stripe checkout and webhook (needs Stripe keys and a public webhook URL).
- OpenAI assistant responses (needs an API key).
- Native map rendering (`react-native-maps` has no web build; needs a device or
  simulator plus a Google Maps key).

These are integration points with external services, not untested logic paths; each is
written against the documented API and isolated behind a single function.
