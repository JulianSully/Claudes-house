import { useCallback, useRef, useState } from "react";
import {
  Grid3x3,
  MessageSquarePlus,
  Trash2,
  Copy,
  Undo2,
  Sun,
  Info,
} from "lucide-react";

import DesignCanvas from "./DesignCanvas";
import {
  makeNote,
  panelCount,
  layoutKw,
  keepOnCanvas,
  updateItem,
  removeItem,
  duplicateArray,
  DEFAULT_PANEL_WIDTH,
} from "./layout";
import { Panel, InputRow } from "../components/ui";
import { kw } from "../lib/format";

/**
 * The design screen.
 *
 * Almost everything happens on the canvas now — drag to draw, handles to size
 * and rotate, keys to nudge and delete. What is left here is what genuinely
 * belongs beside the roof rather than on it: the running kW, the panel spec,
 * and the site scale.
 */
export default function DesignStage({ q }) {
  const {
    siteImage, imageAspect,
    arrays, setArrays,
    notes, setNotes,
    panelWatts, setPanelWatts,
    panelWidth, setPanelWidth,
    systemSizeKw,
  } = q;

  const [selectedId, setSelectedId] = useState(null);
  const history = useRef([]);

  const remember = useCallback(() => {
    history.current = [...history.current.slice(-24), { arrays, notes }];
  }, [arrays, notes]);

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    setArrays(previous.arrays);
    setNotes(previous.notes);
    setSelectedId(null);
  };

  const selected = arrays.find((a) => a.id === selectedId) ?? null;
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const createArray = (array) => {
    remember();
    setArrays([...arrays, keepOnCanvas(array, imageAspect, panelWidth)]);
    setSelectedId(array.id);
  };

  const changeItem = (id, patch) => {
    if (arrays.some((a) => a.id === id)) {
      setArrays(updateItem(arrays, id, patch).map((a) => keepOnCanvas(a, imageAspect, panelWidth)));
    } else {
      setNotes(updateItem(notes, id, patch));
    }
  };

  const deleteItem = (id) => {
    remember();
    if (arrays.some((a) => a.id === id)) setArrays(removeItem(arrays, id));
    else setNotes(removeItem(notes, id));
    setSelectedId(null);
  };

  const duplicate = () => {
    if (!selected) return;
    remember();
    const copy = duplicateArray(selected);
    setArrays([...arrays, copy]);
    setSelectedId(copy.id);
  };

  const addNote = () => {
    remember();
    // Dropped centre-ish so it is never placed off screen, then dragged.
    const note = makeNote({ x: 380, y: 240, text: "New note" });
    setNotes([...notes, note]);
    setSelectedId(note.id);
  };

  const total = panelCount(arrays);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-[320px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Panel
          title="System from this layout"
          icon={Sun}
          action={
            history.current.length > 0 && (
              <button
                type="button"
                onClick={undo}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-slate-500 transition hover:bg-slate-100"
              >
                <Undo2 size={12} /> Undo
              </button>
            )
          }
        >
          <div className="rounded-lg bg-slate-50 px-3 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-slate-600">
                {total} panel{total === 1 ? "" : "s"}
              </span>
              <span className="font-mono text-[20px] font-semibold tabular-nums text-slate-900">
                {kw(layoutKw(arrays, panelWatts))}
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
              {total > 0
                ? "This is the size the quote uses — it overrides the Energy tab."
                : `Nothing placed yet, so the quote uses the ${kw(systemSizeKw)} on the Energy tab.`}
            </p>
          </div>
          <InputRow
            label="Panel wattage"
            hint="per panel"
            unit="W"
            value={panelWatts}
            onChange={setPanelWatts}
            step="5"
          />
        </Panel>

        <Panel title="Scale" icon={Grid3x3}>
          <div>
            <div className="mb-1 flex items-center justify-between text-[13px] text-slate-600">
              <span>Panel size on the photo</span>
              <span className="font-mono text-[12px] text-slate-500">{Math.round(panelWidth)}</span>
            </div>
            <input
              type="range"
              min="14"
              max="110"
              value={panelWidth}
              onChange={(e) => setPanelWidth(Number(e.target.value))}
              aria-label="Panel size on the photo"
              className="w-full accent-brand-600"
            />
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
              Set once so a panel matches the roof in the photo. Every array uses it —
              real panels are all the same size. Doesn't change the system size.
            </p>
          </div>
          <button
            type="button"
            onClick={addNote}
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 py-2 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <MessageSquarePlus size={13} /> Add a label
          </button>
        </Panel>

        {selectedNote && (
          <Panel
            title="Selected label"
            icon={MessageSquarePlus}
            action={
              <button
                type="button"
                onClick={() => deleteItem(selectedNote.id)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            }
          >
            <input
              type="text"
              value={selectedNote.text}
              onChange={(e) => setNotes(updateItem(notes, selectedNote.id, { text: e.target.value }))}
              placeholder="e.g. switchboard"
              className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
          </Panel>
        )}

        {arrays.length > 0 && (
          <Panel title={`Arrays (${arrays.length})`} icon={Grid3x3}>
            <ul className="space-y-1.5">
              {arrays.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-[12.5px] transition ${
                      a.id === selectedId
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>Array {i + 1}</span>
                    <span className="font-mono text-slate-500">
                      {a.cols}×{a.rows} · {a.cols * a.rows}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </aside>

      <main className="min-w-0 flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-[1100px] p-5 lg:p-6">
          {/* Contextual bar — only what applies to what's selected. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-600">
              {selected ? (
                <>
                  <strong className="font-semibold text-slate-800">
                    {selected.cols} × {selected.rows} = {selected.cols * selected.rows} panels
                  </strong>{" "}
                  at {Math.round(selected.rotation)}° — drag the corner to resize, the top
                  knob to rotate
                </>
              ) : (
                <>Drag anywhere on the roof to lay panels. Scroll to zoom, alt-drag to pan.</>
              )}
            </p>
            {selected && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={duplicate}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-[12px] font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>

          <DesignCanvas
            imageSrc={siteImage?.src ?? null}
            aspect={imageAspect}
            arrays={arrays}
            notes={notes}
            panelWidth={panelWidth}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={changeItem}
            onCreate={createArray}
            onDelete={deleteItem}
          />

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500">
            <Info size={12} className="mt-0.5 shrink-0 text-slate-400" />
            A visual layout for the proposal, not an engineering drawing — no shading
            study, no string design, no roof measurements. Its one real job is the panel
            count, which sets the system size on the quote.
          </p>
        </div>
      </main>
    </div>
  );
}
