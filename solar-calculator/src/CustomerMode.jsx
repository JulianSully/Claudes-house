import { useState } from "react";
import { Download, Link2, Check, AlertCircle } from "lucide-react";

import ProposalDocument from "./ProposalDocument";
import { shareUrlFor } from "./lib/proposal";

/**
 * What the rep turns the screen around to show. It is the proposal document
 * itself plus the actions that get it out of the app — nothing else, so there
 * is nothing on screen for a customer to misread.
 *
 * Export is the browser's own print-to-PDF rather than a PDF library: it keeps
 * text selectable, honours the print stylesheet in index.css, needs no
 * dependency, and works on the tablet the rep is already holding.
 */
export default function CustomerMode({ proposal, modeToggle }) {
  const [copied, setCopied] = useState(null); // null | "ok" | "fail"

  const onShare = async () => {
    const url = shareUrlFor(proposal);
    const title = `Solar proposal — ${proposal.customer.name || proposal.customer.address || "your home"}`;

    // On a phone this opens the native share sheet, which is how a rep
    // actually sends this — text message, email, WhatsApp.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // they closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2600);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
      {/* Action bar — hidden when printing, so it never lands in the PDF. */}
      <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-2 px-5 py-2.5">
          {modeToggle}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {copied === "ok" ? <Check size={13} className="text-emerald-600" /> : <Link2 size={13} />}
              {copied === "ok" ? "Link copied" : "Share link"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-card transition hover:bg-brand-700"
            >
              <Download size={13} /> Download proposal
            </button>
          </div>
        </div>
        {copied === "fail" && (
          <div className="mx-auto flex max-w-[860px] items-center gap-1.5 px-5 pb-2.5 text-[12px] text-amber-700">
            <AlertCircle size={13} /> Couldn't copy the link automatically — your browser
            blocked it. Use Download proposal instead.
          </div>
        )}
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="proposal-sheet mx-auto max-w-[860px] overflow-hidden rounded-2xl bg-white shadow-pop">
          <ProposalDocument proposal={proposal} />
        </div>
        <p className="no-print mx-auto mt-4 max-w-[860px] px-1 text-[11.5px] text-slate-500">
          Download proposal opens your device's print dialog — choose "Save as PDF" as the
          destination. The share link carries the numbers but not the photo, so send the PDF
          if you want the house on it.
        </p>
      </div>
    </div>
  );
}
