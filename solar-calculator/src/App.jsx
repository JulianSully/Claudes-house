import { useState } from "react";
import PylonCalculator from "./PylonCalculator";
import SolarSavingsCalculator from "./SolarSavingsCalculator";

/**
 * Two shells over the same locked maths:
 *  - "studio"  — the Pylon-style solar software UI (default)
 *  - "classic" — the original dark estimator, kept verbatim as a reference
 */
export default function App() {
  const [view, setView] = useState("studio");

  if (view === "classic") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setView("studio")}
          className="fixed right-4 top-4 z-50 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur transition hover:border-slate-500"
        >
          ← Studio view
        </button>
        <SolarSavingsCalculator />
      </div>
    );
  }

  return <PylonCalculator onOpenClassic={() => setView("classic")} />;
}
