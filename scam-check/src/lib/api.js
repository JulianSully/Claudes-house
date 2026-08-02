import { supabase, FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./supabase";

/**
 * Thrown for anything the edge functions report. `code` is the machine-readable
 * `error` field; `payload` carries extras such as usage on a limit_reached.
 */
export class ApiError extends Error {
  constructor(code, payload = {}, status = 0) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.payload = payload;
    this.status = status;
  }
}

async function callFunction(name, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ApiError("unauthorized", {}, 401);

  let response;
  try {
    response = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError("network_error", {}, 0);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    /* a body-less error is still an error */
  }

  if (!response.ok) {
    throw new ApiError(payload.error ?? "unknown_error", payload, response.status);
  }

  return payload;
}

/** Run a check. `kind` is "message" or "url". */
export function runCheck({ kind, text }) {
  return callFunction("check-message", { kind, text });
}

/** Plan, checks used this month, renewal date. */
export async function fetchUsage() {
  const { data, error } = await supabase.rpc("current_usage");
  if (error) throw new ApiError("usage_unavailable", { message: error.message });
  return data;
}

export async function startCheckout() {
  const { url } = await callFunction("create-checkout-session");
  return url;
}

export async function openBillingPortal() {
  const { url } = await callFunction("create-portal-session");
  return url;
}

/** Human-readable text for an ApiError code. Kept warm and non-technical. */
export function messageForError(code) {
  switch (code) {
    case "unauthorized":
      return "You have been signed out. Please sign in again.";
    case "empty_input":
      return "There's nothing to check yet — paste the message or address first.";
    case "too_long":
      return "That's longer than we can look at in one go. Try pasting just the part you're unsure about.";
    case "invalid_url":
      return "That doesn't look like a web address. It should look something like example.com/page.";
    case "analysis_failed":
      return "Something went wrong on our side, and we'd rather say so than guess. Please try again in a moment.";
    case "network_error":
      return "We couldn't reach our servers. Check your connection and try again.";
    case "already_subscribed":
      return "You're already on the paid plan.";
    case "no_customer":
      return "We couldn't find a billing account for you yet.";
    default:
      return "Something went wrong. Please try again in a moment.";
  }
}
