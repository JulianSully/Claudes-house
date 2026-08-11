import { useMemo, useState } from "react";
import { PencilLine, Presentation } from "lucide-react";

import RepMode from "./RepMode";
import CustomerMode from "./CustomerMode";
import ProposalDocument from "./ProposalDocument";
import { useQuote } from "./state/useQuote";
import { buildProposal, proposalFromLocation } from "./lib/proposal";

/**
 * Two modes over one quote:
 *
 *   rep      — every field on screen, built for punching numbers in fast while
 *              talking to the customer.
 *   customer — the screen the rep turns around. Plain English, big numbers,
 *              and the export actions.
 *
 * A third path exists but has no toggle: opening a shared link renders the
 * proposal read-only, because the person following that link is the customer
 * at their kitchen table, not the rep.
 */
export default function App() {
  const shared = useMemo(() => proposalFromLocation(), []);
  const [mode, setMode] = useState("rep");
  const q = useQuote();

  // Rebuilt as the rep types so the customer screen is never stale. The date
  // and id are pinned per session rather than regenerated on every keystroke.
  const stamp = useMemo(() => new Date(), []);
  const proposal = useMemo(() => buildProposal(q, { now: stamp }), [q, stamp]);

  if (shared) {
    return (
      <div className="min-h-screen bg-slate-100 py-6 sm:py-8">
        <div className="mx-auto max-w-[860px] overflow-hidden rounded-2xl bg-white shadow-pop">
          <ProposalDocument proposal={shared} />
        </div>
      </div>
    );
  }

  const toggle = <ModeToggle mode={mode} setMode={setMode} />;

  return mode === "rep" ? (
    <RepMode q={q} modeToggle={toggle} />
  ) : (
    <CustomerMode proposal={proposal} modeToggle={toggle} />
  );
}

function ModeToggle({ mode, setMode }) {
  const options = [
    { value: "rep", label: "Rep input", icon: PencilLine },
    { value: "customer", label: "Show customer", icon: Presentation },
  ];

  return (
    <div
      role="group"
      aria-label="Screen mode"
      className="flex rounded-lg bg-slate-100 p-0.5"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${
              active
                ? "bg-white text-slate-900 shadow-card"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
