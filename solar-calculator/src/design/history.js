/**
 * Undo and redo for the roof layout.
 *
 * A rep is laying panels on a customer's house with the customer watching. The
 * cost of a wrong drag has to be one keystroke, not a rebuild — so Ctrl+Z takes
 * the last change back and Ctrl+Y (or Ctrl+Shift+Z) puts it forward again.
 *
 * The model is the standard two-stack one, kept here as plain functions so it
 * can be tested without a browser:
 *
 *   past    — snapshots to go back to, oldest first
 *   future  — snapshots undone but not yet thrown away, next-to-redo first
 *
 * A snapshot is the whole layout ({ arrays, notes }) rather than a description
 * of what changed. Layouts are a few dozen small objects, so copying one costs
 * nothing, and "put it back exactly as it was" is a much easier promise to keep
 * than replaying an inverse of every gesture.
 *
 * DOING something new clears the future. That is not a detail — it is what
 * stops a redo from pasting a block back into a layout it no longer fits.
 */

/** How many steps back the rep can go. Deep enough to cover a whole roof. */
export const HISTORY_LIMIT = 50;

export const emptyHistory = () => ({ past: [], future: [] });

/**
 * Record the state as it was BEFORE a change, which is what going back means.
 * Callers snapshot at the start of a gesture rather than the end.
 */
export function remember(history, snapshot, limit = HISTORY_LIMIT) {
  return { past: [...history.past, snapshot].slice(-limit), future: [] };
}

/**
 * Step back. Returns the state to restore and the history that follows it, or
 * null when there is nothing to undo — so a caller can do nothing rather than
 * having to check first.
 */
export function undo(history, current, limit = HISTORY_LIMIT) {
  if (history.past.length === 0) return null;
  return {
    state: history.past[history.past.length - 1],
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, limit),
    },
  };
}

/** Step forward again, undoing the undo. */
export function redo(history, current, limit = HISTORY_LIMIT) {
  if (history.future.length === 0) return null;
  return {
    state: history.future[0],
    history: {
      past: [...history.past, current].slice(-limit),
      future: history.future.slice(1),
    },
  };
}

export const canUndo = (history) => history.past.length > 0;
export const canRedo = (history) => history.future.length > 0;

/**
 * What a keystroke means, or null for one that isn't ours.
 *
 * Ctrl+Z / Ctrl+Y is the Windows pair the request asked for. Cmd+Z and
 * Cmd+Shift+Z come along for free because half the reps carrying this into a
 * driveway will be on a Mac, where Ctrl+Y means nothing.
 */
export function historyShortcut(event) {
  if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = String(event.key || "").toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y") return "redo";
  return null;
}
