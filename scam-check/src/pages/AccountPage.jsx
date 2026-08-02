import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthPanel from "../components/AuthPanel";
import UpgradePrompt from "../components/UpgradePrompt";
import { ApiError, messageForError, openBillingPortal } from "../lib/api";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function nextResetDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export default function AccountPage() {
  const { session, user, usage, refreshUsage, signOut, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const checkout = params.get("checkout");

  // Stripe redirects back before the webhook has necessarily landed, so poll a
  // few times rather than showing a stale "Free" badge to someone who just paid.
  useEffect(() => {
    if (checkout !== "success") return;
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      const next = await refreshUsage();
      attempts += 1;
      if (cancelled) return;
      if (next?.plan === "pro" || attempts >= 6) return;
      setTimeout(tick, 1500);
    };
    tick();

    return () => {
      cancelled = true;
    };
  }, [checkout, refreshUsage]);

  async function handleManage() {
    setBusy(true);
    setError("");
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(messageForError(err instanceof ApiError ? err.code : "unknown_error"));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="shell">
        <h1 className="page-title">Your account</h1>
        <p className="page-sub">Loading…</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="shell">
        <h1 className="page-title">Your account</h1>
        <p className="page-sub">Sign in to see your plan and how many checks you've used.</p>
        <AuthPanel />
      </section>
    );
  }

  const isPro = usage?.plan === "pro";
  const limit = usage?.limit ?? 5;
  const used = usage?.used ?? 0;
  const remaining = usage?.remaining ?? Math.max(limit - used, 0);
  const periodEnd = formatDate(usage?.current_period_end);

  return (
    <section className="shell">
      <h1 className="page-title">Your account</h1>
      <p className="page-sub">{user?.email}</p>

      {checkout === "success" && (
        <div className="notice notice--good" style={{ marginBottom: 18 }}>
          {isPro
            ? "You're all set — unlimited checks are active. Thank you."
            : "Payment received. Your plan is updating; this page will catch up in a few seconds."}
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="notice notice--info" style={{ marginBottom: 18 }}>
          No problem — nothing was charged. Your free checks are still there.
        </div>
      )}

      <div className="panel">
        <div className="stat-row">
          <span className="stat-row__label">Plan</span>
          <span className="stat-row__value">
            <span className={`plan-badge ${isPro ? "plan-badge--pro" : "plan-badge--free"}`}>
              {isPro ? "Unlimited · $7/mo" : "Free"}
            </span>
          </span>
        </div>

        <div className="stat-row">
          <span className="stat-row__label">Checks used this month</span>
          <span className="stat-row__value">{isPro ? `${used}` : `${used} of ${limit}`}</span>
        </div>

        {!isPro && (
          <div className="stat-row">
            <span className="stat-row__label">Remaining</span>
            <span className="stat-row__value">
              {remaining === 0 ? "None left" : `${remaining} ${remaining === 1 ? "check" : "checks"}`}
            </span>
          </div>
        )}

        <div className="stat-row">
          <span className="stat-row__label">{isPro ? "Renews" : "Allowance resets"}</span>
          <span className="stat-row__value">
            {isPro
              ? usage?.cancel_at_period_end
                ? `Ends ${periodEnd ?? "at the end of this period"}`
                : (periodEnd ?? "Monthly")
              : formatDate(nextResetDate())}
          </span>
        </div>

        <div className="card-actions">
          {isPro ? (
            <button type="button" className="btn btn--secondary" onClick={handleManage} disabled={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {busy ? "Opening…" : "Manage or cancel subscription"}
            </button>
          ) : null}
          <Link className="btn btn--secondary" to="/">
            Run a check
          </Link>
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {error ? (
        <div className="notice notice--bad" style={{ marginTop: 16 }}>
          {error}
        </div>
      ) : null}

      {isPro && usage?.cancel_at_period_end ? (
        <div className="notice notice--info section-gap">
          Your subscription is set to end on {periodEnd ?? "the end of this billing period"}. Until
          then, checks stay unlimited.
        </div>
      ) : null}

      {!isPro && (
        <div className="section-gap">
          <UpgradePrompt
            headline="Check as much as you like"
            blurb="The free plan covers five checks a month, which is plenty for most people. If you're checking things regularly — or keeping an eye on messages for someone else — unlimited removes the counting."
          />
        </div>
      )}
    </section>
  );
}
