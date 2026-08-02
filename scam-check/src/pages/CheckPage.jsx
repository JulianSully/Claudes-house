import { useEffect, useRef, useState } from "react";
import { ApiError, messageForError, runCheck } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AuthPanel from "../components/AuthPanel";
import UpgradePrompt from "../components/UpgradePrompt";
import UsageMeter from "../components/UsageMeter";
import VerdictCard from "../components/VerdictCard";
import { GlobeIcon, LockIcon, MessageIcon } from "../components/icons";

const MAX_CHARS = 8000;

export default function CheckPage() {
  const { session, usage, setUsage, refreshUsage } = useAuth();

  const [kind, setKind] = useState("message");
  // Kept separately so flipping between tabs never eats what someone typed.
  const [messageText, setMessageText] = useState("");
  const [urlText, setUrlText] = useState("");

  const [status, setStatus] = useState("idle"); // idle | checking | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  // If someone typed, hit "Check it", then signed in, run the check they asked
  // for rather than making them press the button a second time.
  const pendingRef = useRef(false);
  const resultRef = useRef(null);

  const text = kind === "url" ? urlText : messageText;
  const setText = kind === "url" ? setUrlText : setMessageText;
  const trimmed = text.trim();
  const outOfChecks = usage?.plan === "free" && (usage?.remaining ?? 1) <= 0;

  async function performCheck() {
    setStatus("checking");
    setError("");
    setResult(null);
    setLimitReached(false);

    try {
      const data = await runCheck({ kind, text: trimmed });
      setResult(data);
      setStatus("done");
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.code === "limit_reached") {
        setLimitReached(true);
        if (err.payload?.usage) setUsage(err.payload.usage);
        return;
      }
      setError(messageForError(err instanceof ApiError ? err.code : "unknown_error"));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!trimmed) return;

    if (!session) {
      pendingRef.current = true;
      setNeedsAuth(true);
      return;
    }
    performCheck();
  }

  useEffect(() => {
    if (session && pendingRef.current) {
      pendingRef.current = false;
      setNeedsAuth(false);
      refreshUsage();
      performCheck();
    }
    // performCheck closes over current input, which is exactly what we want here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (status === "done" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status]);

  function handleReset() {
    setResult(null);
    setStatus("idle");
    setError("");
    setText("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <section className="shell hero">
        <p className="hero__eyebrow">Free · Five checks a month</p>
        <h1>Not sure if it's real? Paste it here.</h1>
        <p>
          A suspicious text, an email that doesn't feel right, a website you were sent — put it in
          below and we'll tell you plainly what we see, and why.
        </p>
      </section>

      <section className="shell">
        <div className="panel check-form">
          <form onSubmit={handleSubmit}>
            <div className="segmented" role="group" aria-label="What would you like to check?">
              <button
                type="button"
                className="segmented__btn"
                aria-pressed={kind === "message"}
                onClick={() => setKind("message")}
              >
                <MessageIcon />
                Message or email
              </button>
              <button
                type="button"
                className="segmented__btn"
                aria-pressed={kind === "url"}
                onClick={() => setKind("url")}
              >
                <GlobeIcon />
                Website address
              </button>
            </div>

            {kind === "message" ? (
              <>
                <label className="field-label" htmlFor="check-message">
                  Paste the message, email, or describe the phone call
                </label>
                <textarea
                  id="check-message"
                  className="textarea"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={
                    "For example:\n\nRoyal Mail: your parcel is being held as a £2.99 fee is unpaid. Pay now to avoid it being returned: rm-parceldelivery.com/pay"
                  }
                  rows={7}
                />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="check-url">
                  Paste the web address
                </label>
                <input
                  id="check-url"
                  className="text-input text-input--url"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  value={urlText}
                  onChange={(e) => setUrlText(e.target.value.slice(0, 2000))}
                  placeholder="paypal.secure-account-verify.com/login"
                />
              </>
            )}

            <div className="form-foot">
              <UsageMeter usage={usage} />
              {kind === "message" && messageText.length > MAX_CHARS - 800 ? (
                <span>
                  {MAX_CHARS - messageText.length} characters left
                </span>
              ) : null}
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={!trimmed || status === "checking"}
            >
              {status === "checking" ? <span className="spinner" aria-hidden="true" /> : null}
              {status === "checking" ? "Having a look…" : "Check it"}
            </button>

            {outOfChecks && !limitReached ? (
              <div className="notice notice--info">
                You've used all five free checks this month. You can still type something in — we'll
                show you what upgrading gets you before you decide.
              </div>
            ) : null}

            {error ? <div className="form-error">{error}</div> : null}

            <p className="privacy-note">
              <LockIcon />
              <span>
                We don't store what you paste. We keep a count of how many checks you've run, and
                that's it.
              </span>
            </p>
          </form>
        </div>

        {needsAuth && !session ? (
          <div className="section-gap">
            <AuthPanel
              heading="One quick step first"
              blurb="Create a free account and we'll run your check straight away. Five free checks a month, and we don't keep what you paste."
            />
          </div>
        ) : null}

        {status === "checking" ? (
          <div className="thinking">
            <span className="thinking__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="thinking__text">
              {kind === "url"
                ? "Looking at the domain and how the address is put together…"
                : "Reading it through properly…"}
            </span>
          </div>
        ) : null}

        <div ref={resultRef}>
          {result ? <VerdictCard result={result} onReset={handleReset} /> : null}
        </div>

        {limitReached ? <UpgradePrompt /> : null}
      </section>
    </>
  );
}
