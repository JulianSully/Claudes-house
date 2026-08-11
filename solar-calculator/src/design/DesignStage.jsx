import { useState } from "react";
import {
  MousePointer2,
  Grid3x3,
  MessageSquarePlus,
  Trash2,
  RotateCw,
  Sun,
  Info,
} from "lucide-react";

import DesignCanvas from "./DesignCanvas";
import {
  makeArray,
  makeNote,
  arraySize,
  panelCount,
  layoutKw,
  keepOnCanvas,
  updateItem,
  removeItem,
  DEFAULT_PANEL_WIDTH,
} from "./layout";
import { Panel, InputRow } from "../components/ui";
import { kw } from "../lib/format";

const TOOLS = [
  { value: "select", label: "Select", icon: MousePointer2, hint: "Move and edit" },
  { value: "array", label: "Panels", icon: Grid3x3, hint: "Click the roof to drop an array" },
  { value: "note", label: "Note", icon: MessageSquarePlus, hint: "Click to place a label" },
];

/**
 * The design screen: lay panels on the roof, label anything worth calling out,
 * and let the panel count set the system size.
 */
export default function DesignStage({ q }) {
  const {
    siteImage, imageAspect,
    arrays, setArrays,
    notes, setNotes,
    panelWatts, setPanelWatts,
    systemSizeKw,
  } = q;

  const [tool, setTool] = useState("select");
  const [selectedId, setSelectedId] = useState(null);

  const selectedArray = arrays.find((a) => a.id === selectedId) ?? null;
  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const placeAt = (point) => {
    if (tool === "array") {
      // Dropped centred on the click, which is where the eye expects it.
      const draft = makeArray({ x: point.x, y: point.y, panelWidth: DEFAULT_PANEL_WIDTH });
      const { width, height } = arraySize(draft);
      const placed = keepOnCanvas(
        { ...draft, x: point.x - width / 2, y: point.y - height / 2 },
        imageAspect
      );
      setArrays([...arrays, placed]);
      setSelectedId(placed.id);
    } else if (tool === "note") {
      const note = makeNote({ x: point.x, y: point.y, text: "New note" });
      setNotes([...notes, note]);
      setSelectedId(note.id);
    }
    setTool("select"); // one placement per click, then back to moving things
  };

  const moveItem = (id, patch) => {
    if (arrays.some((a) => a.id === id)) {
      setArrays(updateItem(arrays, id, patch).map((a) => keepOnCanvas(a, imageAspect)));
    } else {
      setNotes(updateItem(notes, id, patch));
    }
  };

  const patchArray = (patch) => setArrays(updateItem(arrays, selectedId, patch));

  const deleteSelected = () => {
    if (selectedArray) setArrays(removeItem(arrays, selectedId));
    if (selectedNote) setNotes(removeItem(notes, selectedId));
    setSelectedId(null);
  };

  const total = panelCount(arrays);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* ---------- tools & properties ---------- */}
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-[340px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Panel title="Tools" icon={Grid3x3}>
          <div className="grid grid-cols-3 gap-2">
            {TOOLS.map(({ value, label, icon: Icon }) => {
              const active = tool === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTool(value)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border py-2.5 text-[12px] font-medium transition ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>
          <p className="flex items-start gap-1.5 pt-1 text-[11.5px] leading-relaxed text-slate-500">
            <Info size={12} className="mt-0.5 shrink-0 text-slate-400" />
            {TOOLS.find((t) => t.value === tool)?.hint}. Drag anything to move it.
          </p>
        </Panel>

        <Panel title="System from this layout" icon={Sun}>
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
              {total > 0 ? (
                <>
                  This is the system size the quote uses — placing panels here overrides
                  the figure on the Energy tab.
                </>
              ) : (
                <>
                  Nothing placed yet, so the quote uses the {kw(systemSizeKw)} typed on the
                  Energy tab.
                </>
              )}
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

        {selectedArray && (
          <Panel
            title="Selected array"
            icon={Grid3x3}
            action={
              <button
                type="button"
                onClick={deleteSelected}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            }
          >
            <InputRow
              label="Across"
              hint="panels wide"
              unit=""
              value={selectedArray.cols}
              onChange={(v) => patchArray({ cols: Math.max(1, Math.min(40, Math.round(v || 1))) })}
              step="1"
              min="1"
            />
            <InputRow
              label="Down"
              hint="panels deep"
              unit=""
              value={selectedArray.rows}
              onChange={(v) => patchArray({ rows: Math.max(1, Math.min(40, Math.round(v || 1))) })}
              step="1"
              min="1"
            />
            <div>
              <div className="mb-1 flex items-center justify-between text-[13px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <RotateCw size={13} /> Angle
                </span>
                <span className="font-mono text-[12px] text-slate-500">
                  {Math.round(selectedArray.rotation)}°
                </span>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                value={selectedArray.rotation}
                onChange={(e) => patchArray({ rotation: Number(e.target.value) })}
                aria-label="Array angle"
                className="w-full accent-brand-600"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[13px] text-slate-600">
                <span>Panel size on the photo</span>
                <span className="font-mono text-[12px] text-slate-500">
                  {Math.round(selectedArray.panelWidth)}
                </span>
              </div>
              <input
                type="range"
                min="16"
                max="120"
                value={selectedArray.panelWidth}
                onChange={(e) => patchArray({ panelWidth: Number(e.target.value) })}
                aria-label="Panel size on the photo"
                className="w-full accent-brand-600"
              />
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                Scale the panels to match the roof in the photo. Doesn't change the system
                size — only how it looks.
              </p>
            </div>
          </Panel>
        )}

        {selectedNote && (
          <Panel
            title="Selected note"
            icon={MessageSquarePlus}
            action={
              <button
                type="button"
                onClick={deleteSelected}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            }
          >
            <label className="block">
              <span className="mb-1 block text-[13px] text-slate-600">Label</span>
              <input
                type="text"
                value={selectedNote.text}
                onChange={(e) => setNotes(updateItem(notes, selectedId, { text: e.target.value }))}
                placeholder="e.g. switchboard, or shading from the gum"
                className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              />
            </label>
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

      {/* ---------- canvas ---------- */}
      <main className="min-w-0 flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-[1100px] p-5 lg:p-6">
          <DesignCanvas
            imageSrc={siteImage?.src ?? null}
            aspect={imageAspect}
            arrays={arrays}
            notes={notes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={moveItem}
            tool={tool}
            onCanvasClick={placeAt}
          />
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
            A visual layout for the proposal, not an engineering drawing — no shading
            study, no string design, no roof measurements. Its one real job is the panel
            count, which sets the system size on the quote.
          </p>
        </div>
      </main>
    </div>
  );
}
