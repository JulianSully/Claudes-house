// POST /functions/v1/stripe-webhook
//
// The only writer of subscription state. Deploy with --no-verify-jwt: Stripe
// authenticates with a signature header, not a Supabase JWT.
//
//   supabase functions deploy stripe-webhook --no-verify-jwt

import Stripe from "npm:stripe@^17.0.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Statuses that should actually unlock unlimited checks. */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

async function applySubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // Prefer the metadata we set at checkout; fall back to the customer id, which
  // we store the moment we create the customer.
  const userId = subscription.metadata?.supabase_user_id ?? null;

  const isActive = ACTIVE_STATUSES.has(subscription.status);
  const periodEnd = subscription.items?.data?.[0]?.current_period_end ??
    // Older API versions expose this on the subscription itself.
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  const patch = {
    plan: isActive ? "pro" : "free",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };

  const query = admin.from("profiles").update(patch);
  const { error } = userId
    ? await query.eq("id", userId)
    : await query.eq("stripe_customer_id", customerId);

  if (error) {
    console.error("profile_update_failed", { subscription: subscription.id, error });
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    // Async variant — the sync one uses Node crypto, which Deno does not provide here.
    event = await stripe.webhooks.constructEventAsync(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("signature_verification_failed", err);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // client_reference_id is the most reliable link back to our user.
        if (session.client_reference_id && !subscription.metadata?.supabase_user_id) {
          subscription.metadata = {
            ...subscription.metadata,
            supabase_user_id: session.client_reference_id,
          };
        }

        await applySubscription(subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }

      default:
        // Everything else is noise for our purposes.
        break;
    }
  } catch (err) {
    // A non-2xx makes Stripe retry, which is what we want for a transient failure.
    console.error("webhook_handler_failed", { type: event.type, err });
    return new Response("handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
