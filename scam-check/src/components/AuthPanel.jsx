import { useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Email + password, with a magic link as the no-password route. Used both as a
 * standalone sign-in page and inline under the check form, so the copy takes a
 * `context` hint rather than assuming.
 */
export default function AuthPanel({ heading, blurb }) {
  const [mode, setMode] = useState("signin"); // signin | signup | magic
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (mode === "magic") {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setNotice(`Check ${email} — we've sent you a link that signs you straight in.`);
      } else if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setNotice(
          "Account created. If your project has email confirmation switched on, check your inbox to confirm — otherwise you're already signed in.",
        );
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err?.message ?? "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const submitLabel =
    mode === "magic" ? "Email me a sign-in link" : mode === "signup" ? "Create account" : "Sign in";

  return (
    <div className="panel auth-card">
      <h2>{heading ?? (mode === "signup" ? "Create your free account" : "Sign in")}</h2>
      <p>
        {blurb ??
          "Five free checks a month. We use an account only to keep count — nothing you paste is stored."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="auth-email">
            Email address
          </label>
          <input
            id="auth-email"
            className="text-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {mode !== "magic" && (
          <div>
            <label className="field-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="text-input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            />
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? "One moment…" : submitLabel}
        </button>
      </form>

      {error ? <div className="notice notice--bad">{error}</div> : null}
      {notice ? <div className="notice notice--good">{notice}</div> : null}

      <div className="auth-switch">
        {mode === "signin" && (
          <>
            <span>New here?</span>
            <button type="button" className="link-btn" onClick={() => setMode("signup")}>
              Create an account
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" className="link-btn" onClick={() => setMode("magic")}>
              Sign in without a password
            </button>
          </>
        )}
        {mode === "signup" && (
          <>
            <span>Already have an account?</span>
            <button type="button" className="link-btn" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
        {mode === "magic" && (
          <>
            <span>Rather use a password?</span>
            <button type="button" className="link-btn" onClick={() => setMode("signin")}>
              Sign in with a password
            </button>
          </>
        )}
      </div>
    </div>
  );
}
