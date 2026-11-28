import { formatShortcut } from "@ui-sdk/core/shortcuts";

// Collapse to the chip, and hide everything. Both work with focus anywhere on the page, in a
// text field, and inside the viewport frame.
//
// Cmd+H was the obvious pick for "hide", but macOS takes it to hide the browser itself before
// the page sees it, and Ctrl+H is History in most browsers elsewhere. Cmd+/ and Ctrl+/ are free.
export const COLLAPSE_SHORTCUT = "mod+.";
export const HIDE_SHORTCUT = "mod+/";

export const collapseLabel = () => formatShortcut(COLLAPSE_SHORTCUT);
export const hideLabel = () => formatShortcut(HIDE_SHORTCUT);

/** The frame forwards to the top window, which owns the toolbar. */
export const COLLAPSE_EVENT = "devbelt:toolbar-collapse";
export const HIDE_EVENT = "devbelt:toolbar-hide";

const isApple = () =>
  /Mac|iPhone|iPad/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform ?? navigator.userAgent,
  );

// "mod" is Command on Apple platforms and Control elsewhere. Only the modifier and the key: no
// Shift, no Alt.
const modOnly = (event: KeyboardEvent) =>
  (isApple() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
  !event.altKey &&
  !event.shiftKey;

// By the character typed, so a layout that puts "." elsewhere still works; by the physical key
// when the layout types something that is not ASCII (Thai, Cyrillic, ...), where the character
// can never be "." or "/".
const isKey = (event: KeyboardEvent, character: string, code: string) =>
  event.key === character ||
  (event.code === code && !/^[\x20-\x7e]$/.test(event.key));

/** Which toolbar shortcut a key press is, if any. */
export function toolbarShortcut(event: KeyboardEvent): "collapse" | "hide" | null {
  if (event.repeat || !modOnly(event)) return null;
  if (isKey(event, ".", "Period")) return "collapse";
  if (isKey(event, "/", "Slash")) return "hide";
  return null;
}

/** Listens for the shortcuts. Calls `handlers` and keeps the browser from also acting on the key. */
export function installToolbarShortcuts(handlers: {
  collapse: () => void;
  hide: () => void;
}): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const action = toolbarShortcut(event);
    if (!action) return;
    event.preventDefault();
    handlers[action]();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

/** From inside the viewport frame: ask the top window to do it. */
export function forwardToTop(name: string) {
  const event = new CustomEvent(name);
  try {
    (window.top ?? window).dispatchEvent(event);
  } catch {
    window.dispatchEvent(event);
  }
}
