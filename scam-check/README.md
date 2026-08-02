# Scam Check

Paste a suspicious text, email, or web address and get a plain-English read on
whether it's likely a scam — with a colour-coded verdict, the specific things
that stood out (quoted), and one safe next step.

Two modes:

| Mode | Input | What happens |
| --- | --- | --- |
| **Message or email** | The text itself, or a description of a phone call | Claude assesses it as a scam-detection expert |
| **Website address** | A URL or bare domain | The domain is picked apart deterministically first (lookalikes, homographs, subdomain padding, embedded userinfo, risky TLDs, shorteners), and those findings are handed to Claude as facts to explain |

---

## Try it without setting anything up

`demo/index.html` is a single self-contained file — no build, no keys, no
network. Open it in a browser and the whole interface works.

What's real in the demo and what isn't:

- **Website checks are faithful.** The domain analysis is a direct port of
  `supabase/functions/_shared/url-analysis.ts`, so the findings are exactly what
  production works from.
- **Message checks are not the model.** They run local pattern-matching instead
  of Claude. Treat those verdicts as a preview of the interface, not of the real
  quality — the whole point of the production version is that Claude reads the
  message rather than matching keywords against it.
- **Payments are switched off.** The free limit and the upgrade panel behave
  normally; the upgrade button just lifts the limit so you can keep trying it.
  Usage is counted in `localStorage`.

Sample scams and legitimate messages are built in, so there's something to click
straight away.

---

## Stack

- **Frontend** — React + Vite, deployable as a static site
- **Auth + database** — Supabase (email/password and magic link; Postgres for usage and subscription state)
- **Analysis** — Anthropic API (`claude-sonnet-4-6`), called from a Supabase Edge Function so the key never reaches a browser
- **Billing** — Stripe Checkout subscriptions + a webhook that writes plan changes back to Postgres

```
src/
  pages/CheckPage.jsx        the main screen: mode switch, input, verdict
  pages/AccountPage.jsx      plan, usage this month, upgrade / cancel
  components/VerdictCard.jsx the signature element
  components/AuthPanel.jsx   email+password and magic link
  components/UpgradePrompt.jsx  inline, never a wall
  lib/api.js                 typed calls into the edge functions
  context/AuthContext.jsx    session + usage state
supabase/
  migrations/0001_init.sql   schema, RLS, current_usage() RPC
  functions/
    check-message/           quota enforcement + the Claude call
    create-checkout-session/ Stripe Checkout
    create-portal-session/   Stripe billing portal (manage / cancel)
    stripe-webhook/          the only writer of subscription state
    _shared/url-analysis.ts  offline domain heuristics
```

---

## Pricing model

| Plan | Price | Checks |
| --- | --- | --- |
| Free | — | 5 per calendar month (UTC), counted per user |
| Unlimited | $7/month | Unlimited |

The limit is enforced **server-side** in `check-message`. The browser's copy of
the count is a display convenience; it is never the gate.

When a free user runs out, the form stays usable and an upgrade panel appears
inline beneath it — whatever they typed is still sitting there if they decide
not to pay.

---

## Privacy

`checks` records the verdict, the kind of check, the domain (URL checks only),
and a timestamp. **The pasted message is never written to the database or to
logs.** People paste bank texts and family messages into this; there is no
reason to keep them.

---

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then note from
**Project Settings → API**:

- Project URL — `https://YOUR-REF.supabase.co`
- `anon` public key
- `service_role` secret key (never goes in the frontend)

Apply the schema:

```bash
npm i -g supabase
supabase link --project-ref YOUR-REF
supabase db push
```

Or paste `supabase/migrations/0001_init.sql` into the SQL editor.

In **Authentication → URL Configuration**, set the Site URL to where the app
will live (`http://localhost:5173` while developing) so magic links and
confirmation emails come back to the right place.

### 2. Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com). It is
used only inside the edge function.

### 3. Stripe

1. Create a **recurring product** — $7 / month. Copy its **price ID**
   (`price_…`), not the product ID.
2. Copy your **secret key** (`sk_test_…` while developing).
3. After deploying the functions (step 5), add a webhook endpoint pointing at
   `https://YOUR-REF.supabase.co/functions/v1/stripe-webhook`, subscribed to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy the resulting **signing secret** (`whsec_…`).

### 4. Edge function secrets

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-… \
  STRIPE_SECRET_KEY=sk_test_… \
  STRIPE_PRICE_ID=price_… \
  STRIPE_WEBHOOK_SECRET=whsec_… \
  SITE_URL=http://localhost:5173 \
  ALLOWED_ORIGINS=http://localhost:5173
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically — you do not set those.

Update `SITE_URL` and `ALLOWED_ORIGINS` to your real domain when you go live;
`SITE_URL` is where Stripe returns people after checkout.

### 5. Deploy the functions

```bash
supabase functions deploy check-message
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` on the webhook is required: Stripe authenticates with a
signature header, not a Supabase JWT. (`supabase/config.toml` records this too.)

### 6. Frontend

```bash
cp .env.example .env.local     # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Only `VITE_`-prefixed variables reach the browser, and the two that do are
public by design. The Anthropic and Stripe keys are deliberately absent.

### 7. Build and host

```bash
npm run build     # → dist/
```

Any static host works. `public/_redirects` (Netlify) and `vercel.json` are
included so client-side routes like `/account` resolve on refresh; on other
hosts, add the equivalent SPA fallback to `index.html`.

---

## Testing the billing loop locally

```bash
stripe listen --forward-to https://YOUR-REF.supabase.co/functions/v1/stripe-webhook
```

Use card `4242 4242 4242 4242`, any future expiry, any CVC. After checkout the
account page polls for a few seconds while the webhook lands, so a briefly stale
"Free" badge is expected and self-correcting.

---

## Notes on the design

The visual language is drawn from consumer-safety and banking-security pages
rather than software products: deep navy on a cool paper-grey field, one
restrained blue accent, Public Sans (the US Web Design System typeface) for
everything functional, and Source Serif 4 reserved almost entirely for the
verdict headline.

The verdict card is the piece that had to carry the product. The colour bar
across the top is the three-second read, before a single word is processed; the
glyph and headline confirm it; the quoted evidence is what makes the answer
trustworthy rather than oracular. Red flags animate in with a short stagger, and
all motion is disabled under `prefers-reduced-motion`.

---

## Known limits and obvious next steps

- **URL checks are offline.** We never fetch the page. That is deliberate —
  pulling attacker-controlled HTML into a prompt is a poor trade, and a phishing
  kit will happily serve a bank's real homepage to a datacentre IP. The cost is
  that we cannot see page content, and we cannot see domain age. Adding a WHOIS
  or domain-age lookup (a domain registered nine days ago is one of the strongest
  single phishing signals there is) would be the highest-value next addition; it
  needs a third-party API key.
- **The brand list in `_shared/url-analysis.ts` is hand-maintained** and skewed
  toward UK/US consumer brands. It is a list to grow, not a complete one — the
  model still reasons about brands that aren't on it, just without the
  deterministic backstop.
- **The public-suffix handling is an approximation** (a short list of common
  multi-part suffixes like `co.uk`). A real PSL would be more correct for
  unusual TLDs.
- **Usage counts reset on the 1st, UTC**, regardless of the subscriber's
  timezone or signup date.
- **No rate limiting beyond the monthly quota.** A paid account can call the
  Claude API as fast as it likes; worth adding a per-minute cap before launch.
