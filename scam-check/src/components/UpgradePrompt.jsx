import { useState } from "react";
import { CheckIcon } from "./icons";
import { ApiError, messageForError, startCheckout } from "../lib/api";

/**
 * Shown inline when a free user runs out, and on the account page. Deliberately
 * not a modal and not a blocker: the form above it stays usable, and whatever
 * the person typed is still sitting there when they come back.
 */
export default function UpgradePrompt({ headline, blurb }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setBusy(true);
    setError("");
    try {
      const url = await startCheckout();
      window.location.href = url;
    } catch (err) {
      setError(messageForError(err instanceof ApiError ? err.code : "unknown_error"));
      setBusy(false);
    }
  }

  return (
    <section className="upsell">
      <p className="upsell__kicker">Scam Check Unlimited</p>
      <h2>{headline ?? "You've used your five free checks this month"}</h2>
      <p>
        {blurb ??
          "Your allowance resets on the 1st. If you're checking things often — or you're keeping an eye on messages for a parent or grandparent — unlimited works out at about 23p a check."}
      </p>

      <ul className="upsell__list">
        <li>
          <CheckIcon size={15} />
          <span>As many message and website checks as you need</span>
        </li>
        <li>
          <CheckIcon size={15} />
          <span>The same careful read, every time — nothing is rationed</span>
        </li>
        <li>
          <CheckIcon size={15} />
          <span>Cancel any time, in two clicks, from your account page</span>
        </li>
      </ul>

      <div className="upsell__cta">
        <button type="button" className="btn btn--primary btn--lg" onClick={handleUpgrade} disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? "Opening checkout…" : "Upgrade for $7 a month"}
        </button>
        <span className="upsell__price">Secure payment by Stripe</span>
      </div>

      {error ? (
        <div className="notice notice--bad" style={{ marginTop: 16 }}>
          {error}
        </div>
      ) : null}
    </section>
  );
}
