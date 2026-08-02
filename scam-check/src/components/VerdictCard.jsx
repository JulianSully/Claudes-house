import { InfoIcon, ShieldAlert, ShieldCheck, ShieldQuestion } from "./icons";

/**
 * Titles are deliberately different for messages and websites. "Looks safe" is
 * the right phrase for a text; for a domain, "Looks legitimate" says the thing
 * people actually want to know.
 */
const COPY = {
  likely_scam: {
    message: { kicker: "Our read", title: "This is likely a scam", section: "What stood out" },
    url: { kicker: "Our read", title: "This is likely a fake site", section: "What stood out" },
    Icon: ShieldAlert,
  },
  uncertain: {
    message: { kicker: "Our read", title: "Uncertain — be cautious", section: "What we noticed" },
    url: { kicker: "Our read", title: "Uncertain — be cautious", section: "What we noticed" },
    Icon: ShieldQuestion,
  },
  looks_safe: {
    message: { kicker: "Our read", title: "This looks safe", section: "Why it looks genuine" },
    url: { kicker: "Our read", title: "This looks legitimate", section: "Why it looks genuine" },
    Icon: ShieldCheck,
  },
};

const CONFIDENCE_TEXT = {
  high: "We're fairly confident about this.",
  medium: "Reasonably confident, based on what we can see.",
  low: "There's not much to go on here, so treat this as a hint rather than an answer.",
};

export default function VerdictCard({ result, onReset }) {
  const kind = result.kind === "url" ? "url" : "message";
  const config = COPY[result.verdict] ?? COPY.uncertain;
  const copy = config[kind];
  const Icon = config.Icon;

  return (
    <section className="verdict" data-verdict={result.verdict} aria-live="polite">
      <div className="verdict__head">
        <div className="verdict__badge">
          <Icon />
        </div>
        <div>
          <p className="verdict__kicker">{copy.kicker}</p>
          <h2 className="verdict__title">{copy.title}</h2>
          {result.domain ? (
            <p className="verdict__domain-line">
              <span className="verdict__domain">{result.domain}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="verdict__body">
        {/* Full width rather than squeezed beside the badge — on a phone the
            headline needs the whole line. */}
        <p className="verdict__confidence">
          {CONFIDENCE_TEXT[result.confidence] ?? CONFIDENCE_TEXT.medium}
        </p>
        <p className="verdict__summary">{result.summary}</p>

        {result.signals?.length > 0 && (
          <>
            <p className="verdict__section-label">{copy.section}</p>
            <ul className="signals">
              {result.signals.map((signal, i) => (
                <li className="signal" key={`${signal.label}-${i}`} style={{ "--i": i }}>
                  <span className="signal__marker" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <p className="signal__label">{signal.label}</p>
                    {signal.quote ? <p className="signal__quote">{signal.quote}</p> : null}
                    <p className="signal__why">{signal.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {result.advice ? (
          <div className="advice">
            <p className="advice__label">What to do next</p>
            <p>{result.advice}</p>
          </div>
        ) : null}

        <div className="verdict__actions">
          <button type="button" className="btn btn--secondary" onClick={onReset}>
            Check something else
          </button>
        </div>
      </div>

      <div className="disclaimer">
        <InfoIcon />
        <p>
          <strong>This is a helpful first read, not a guarantee.</strong> We can only judge what
          you pasted in. Trust your instincts: if something still feels wrong, it probably is. Never
          use a phone number or link from the message itself — hang up, look up the official number
          on your card or the company's website, and call them directly.
        </p>
      </div>
    </section>
  );
}
