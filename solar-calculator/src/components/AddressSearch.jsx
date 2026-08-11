import { useEffect, useId, useRef, useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";

import { searchAddresses, resolveAddress, liveSearchAvailable } from "../lib/addressSearch";

/**
 * Address field with suggestions.
 *
 * It stays a plain text input underneath: a rep can type an address that no
 * provider knows — a new estate, a rural property — and the quote still works.
 * The suggestions are an accelerator, never a gate.
 *
 * Keyboard: ArrowUp/Down to move, Enter to take, Escape to dismiss. Wired as a
 * combobox so it announces itself properly.
 */
export default function AddressSearch({ value, onChange, onResolved }) {
  const id = useId();
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("sample");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");

  const boxRef = useRef(null);
  const abortRef = useRef(null);
  // Set while a suggestion is being applied, so echoing the chosen text back
  // into the input doesn't immediately reopen the list.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return undefined;
    }
    const query = value ?? "";
    if (query.trim().length < 3) {
      setItems([]);
      setOpen(false);
      return undefined;
    }

    // Debounced: a keystroke a provider never sees is a keystroke nobody pays
    // for, and the list stops flickering.
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setError("");
      try {
        const result = await searchAddresses(query, { signal: controller.signal });
        setItems(result.items);
        setMode(result.mode);
        if (result.error) setError(result.error);
        setOpen(result.items.length > 0 || Boolean(result.error));
        setActive(-1);
      } catch (err) {
        if (err?.name !== "AbortError") setError(err.message);
      } finally {
        setBusy(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [value]);

  // Clicking anywhere else puts the list away.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = async (item) => {
    setOpen(false);
    setBusy(true);
    setError("");
    try {
      const resolved = await resolveAddress(item);
      skipNextSearch.current = true;
      onChange(resolved?.address ?? item.label);
      onResolved?.(resolved);
    } catch (err) {
      setError(err.message);
      skipNextSearch.current = true;
      onChange(item.label);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <span className="mb-1 block text-[13px] text-slate-600">Address</span>
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder="Start typing the address…"
          className="h-9 w-full rounded-md border border-slate-300 pl-8 pr-8 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
        />
        {busy && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}

        {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-pop"
        >
          {mode === "sample" && items.length > 0 && (
            <li className="border-b border-slate-100 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800">
              Sample addresses — add a maps key for real search
            </li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                type="button"
                onPointerDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] leading-snug transition ${
                  i === active ? "bg-brand-50 text-brand-900" : "text-slate-700"
                }`}
              >
                <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                {item.label}
              </button>
            </li>
          ))}
          {error && (
            <li className="px-3 py-2 text-[12px] text-amber-700">
              {error} — type the address in full instead.
            </li>
          )}
        </ul>
        )}
      </div>

      {!liveSearchAvailable() && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
          Add a maps key to search real addresses and pull the aerial view in
          automatically.
        </p>
      )}
    </div>
  );
}
