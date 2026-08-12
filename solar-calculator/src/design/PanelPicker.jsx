import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star, ChevronDown, Check, GripVertical } from "lucide-react";

import {
  PANELS,
  panelById,
  panelLabel,
  searchPanels,
  orderByFavourites,
  loadFavourites,
  saveFavourites,
  toggleFavourite,
  CUSTOM_PANEL_ID,
} from "./panels";

/**
 * Choosing the panel, and getting one onto the roof.
 *
 * Two things sit together here because they are one action in the rep's head:
 * pick the module, put it on the house. The palette tile below the picker is
 * draggable — drag it onto the aerial and a panel lands where it is dropped.
 * There is no roof plane to define first, no wizard; the module IS the tool.
 *
 * This tile is also the ONLY way a panel gets created. Everything after the
 * first one comes from the build tool, which is why it is drawn as a target
 * rather than tucked in as a decoration.
 *
 * Favourites exist because a rep sells the same three or four panels all year.
 * Starring them puts them at the top of the list for every job after this one.
 */
export default function PanelPicker({ panelId, onPick, panelSpec, panelWatts }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState(() => loadFavourites());
  const boxRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => saveFavourites(favourites), [favourites]);

  // Clicking anywhere else closes it, the way a select does.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const results = useMemo(
    () => orderByFavourites(searchPanels(query), favourites),
    [query, favourites]
  );

  const current = panelById(panelId);

  return (
    <div className="space-y-2.5" ref={boxRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-left transition hover:bg-slate-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-slate-900">
              {panelLabel(current)}
            </span>
            <span className="block text-[11px] text-slate-500">
              {panelWatts || current.watts} W · {current.longMm} × {current.shortMm} mm
            </span>
          </span>
          <ChevronDown size={14} className="shrink-0 text-slate-400" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop">
            <div className="relative border-b border-slate-100">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Brand, model or wattage"
                className="h-9 w-full pl-8 pr-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <ul className="max-h-[280px] overflow-y-auto py-1">
              {results.length === 0 && (
                <li className="px-3 py-4 text-center text-[12px] leading-relaxed text-slate-500">
                  Nothing matching “{query}”.
                  <button
                    type="button"
                    onClick={() => {
                      onPick(CUSTOM_PANEL_ID);
                      setOpen(false);
                    }}
                    className="mt-1 block w-full text-[12px] font-medium text-brand-600 hover:underline"
                  >
                    Enter it as a custom panel
                  </button>
                </li>
              )}
              {results.map((p) => {
                const starred = favourites.includes(p.id);
                return (
                  <li key={p.id}>
                    <div
                      className={`flex items-center gap-1 px-1.5 ${
                        p.id === panelId ? "bg-brand-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onPick(p.id);
                          setOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-slate-800">
                            {panelLabel(p)}
                          </span>
                          <span className="block font-mono text-[10.5px] text-slate-400">
                            {p.watts} W · {p.longMm} × {p.shortMm}
                          </span>
                        </span>
                        {p.id === panelId && (
                          <Check size={13} className="shrink-0 text-brand-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFavourites((f) => toggleFavourite(f, p.id))}
                        title={starred ? "Remove from favourites" : "Save as a favourite"}
                        aria-label={starred ? "Remove from favourites" : "Save as a favourite"}
                        aria-pressed={starred}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded transition hover:bg-slate-200/70"
                      >
                        <Star
                          size={13}
                          className={starred ? "text-amber-500" : "text-slate-300"}
                          fill={starred ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10.5px] leading-relaxed text-slate-500">
              {PANELS.length - 1} modules, starting points only — star the ones you sell,
              and check the datasheet before it goes to a customer.
            </p>
          </div>
        )}
      </div>

      <PaletteTile panelSpec={panelSpec} panelWatts={panelWatts} />
    </div>
  );
}

/**
 * The thing you drag onto the roof.
 *
 * It is drawn to the chosen panel's real proportions, so what leaves the
 * palette looks like what lands on the house.
 */
function PaletteTile({ panelSpec, panelWatts }) {
  const ratio = panelSpec.shortMm / panelSpec.longMm;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        // Some browsers refuse to start a drag with an empty payload.
        e.dataTransfer.setData("text/plain", "helios/panel");
      }}
      role="button"
      tabIndex={0}
      title="Drag me onto the roof"
      className="flex cursor-grab items-center gap-3 rounded-lg border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2.5 active:cursor-grabbing"
    >
      <GripVertical size={14} className="shrink-0 text-brand-400" />
      <div
        className="shrink-0 rounded-[2px] border border-sky-300 bg-[#0F2744]"
        style={{ width: 46, height: 46 * ratio }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-brand-900">Drag onto the roof</div>
        <div className="text-[11px] text-brand-800/70">
          {panelWatts || panelSpec.watts} W · then use Build to lay the rest
        </div>
      </div>
    </div>
  );
}
