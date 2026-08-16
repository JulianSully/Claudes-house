import { describe, it, expect } from "vitest";

import {
  emptyHistory,
  remember,
  undo,
  redo,
  canUndo,
  canRedo,
  historyShortcut,
  HISTORY_LIMIT,
} from "./history";

const layout = (n) => ({ arrays: Array.from({ length: n }, (_, i) => ({ id: `a${i}` })), notes: [] });

describe("stepping back and forward", () => {
  it("has nothing to undo or redo on a fresh screen", () => {
    const h = emptyHistory();
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h, layout(0))).toBeNull();
    expect(redo(h, layout(0))).toBeNull();
  });

  it("puts back exactly what was there before the change", () => {
    const before = layout(3);
    const after = layout(4);
    const h = remember(emptyHistory(), before);

    const step = undo(h, after);
    expect(step.state).toBe(before);
    expect(canUndo(step.history)).toBe(false);
    expect(canRedo(step.history)).toBe(true);
  });

  it("redoes what the undo took away", () => {
    const before = layout(3);
    const after = layout(4);

    const undone = undo(remember(emptyHistory(), before), after);
    const redone = redo(undone.history, undone.state);

    expect(redone.state).toBe(after);
    expect(canUndo(redone.history)).toBe(true);
    expect(canRedo(redone.history)).toBe(false);
  });

  it("walks back through several changes in order, then forward again", () => {
    const states = [layout(1), layout(2), layout(3), layout(4)];
    let h = emptyHistory();
    for (const s of states.slice(0, 3)) h = remember(h, s);

    let current = states[3];
    const walked = [];
    for (let i = 0; i < 3; i += 1) {
      const step = undo(h, current);
      h = step.history;
      current = step.state;
      walked.push(current);
    }
    expect(walked).toEqual([states[2], states[1], states[0]]);
    expect(canUndo(h)).toBe(false);

    const forward = [];
    for (let i = 0; i < 3; i += 1) {
      const step = redo(h, current);
      h = step.history;
      current = step.state;
      forward.push(current);
    }
    expect(forward).toEqual([states[1], states[2], states[3]]);
  });

  it("throws the redo away as soon as something new is done", () => {
    // Otherwise a redo would paste a block back into a layout it no longer fits.
    const undone = undo(remember(emptyHistory(), layout(1)), layout(2));
    expect(canRedo(undone.history)).toBe(true);

    const afterNewWork = remember(undone.history, layout(9));
    expect(canRedo(afterNewWork)).toBe(false);
    expect(canUndo(afterNewWork)).toBe(true);
  });

  it("never mutates the history it was handed", () => {
    const h = remember(emptyHistory(), layout(1));
    const snapshot = JSON.stringify(h);
    undo(h, layout(2));
    redo(remember(h, layout(3)), layout(4));
    expect(JSON.stringify(h)).toBe(snapshot);
  });

  it("forgets the oldest steps rather than growing without limit", () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) h = remember(h, layout(i));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    // The most recent are the ones kept.
    expect(h.past[h.past.length - 1].arrays).toHaveLength(HISTORY_LIMIT + 19);
  });
});

describe("the keystrokes", () => {
  const press = (key, extra = {}) => ({ key, ...extra });

  it("reads Ctrl+Z as undo and Ctrl+Y as redo", () => {
    expect(historyShortcut(press("z", { ctrlKey: true }))).toBe("undo");
    expect(historyShortcut(press("y", { ctrlKey: true }))).toBe("redo");
  });

  it("takes the Mac pair as well", () => {
    expect(historyShortcut(press("z", { metaKey: true }))).toBe("undo");
    expect(historyShortcut(press("z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(historyShortcut(press("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
  });

  it("ignores the same keys pressed on their own", () => {
    expect(historyShortcut(press("z"))).toBeNull();
    expect(historyShortcut(press("y"))).toBeNull();
  });

  it("leaves other shortcuts alone", () => {
    expect(historyShortcut(press("s", { ctrlKey: true }))).toBeNull();
    expect(historyShortcut(press("z", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(historyShortcut(null)).toBeNull();
    expect(historyShortcut({})).toBeNull();
  });
});
