import { useSyncExternalStore } from "react";

import {
  DISPLAY_DEFAULTS,
  findViewport,
  readDisplay,
  readStoredViewport,
  resolveViewport,
  VIEWPORT_SELECT_EVENT,
  VIEWPORT_STORAGE_KEY,
  VIEWPORTS,
  writeDisplay,
  type DisplaySettings,
  type Viewport,
} from "../../core/viewports";
import { writeString } from "../../core/storage";

const HUD_VISIBLE_MS = 900;
const HUD_EXIT_MS = 200;

export type Hud = { key: number; label: string; size: string; leaving: boolean };

export type ViewportState = {
  /** Id of the framed device, or null for the full page. */
  active: string | null;
  /** What the frame loads. Set once and kept, so the framed app keeps its own navigation. */
  src: string | null;
  display: DisplaySettings;
  hud: Hud | null;
  /** Bumps every time the frame finishes loading. */
  frameVersion: number;
};

const SERVER_STATE: ViewportState = {
  active: null,
  src: null,
  display: DISPLAY_DEFAULTS,
  hud: null,
  frameVersion: 0,
};

let state: ViewportState | null = null;
let frame: HTMLIFrameElement | null = null;
let hudTimers: number[] = [];
const listeners = new Set<() => void>();

export function getViewportState(): ViewportState {
  if (typeof window === "undefined") return SERVER_STATE;
  return (state ??= {
    active: readStoredViewport(),
    src: readStoredViewport() ? window.location.href : null,
    display: readDisplay(),
    hud: null,
    frameVersion: 0,
  });
}

function set(patch: Partial<ViewportState>) {
  state = { ...getViewportState(), ...patch };
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useViewportState = () =>
  useSyncExternalStore(subscribe, getViewportState, () => SERVER_STATE);

export const presetOf = (s: ViewportState): Viewport | null => {
  const base = findViewport(s.active);
  return base ? resolveViewport(base, s.display) : null;
};

/** Frames the page at a device (or `full` to remove the frame). Works from any frame. */
export function selectViewport(id: string) {
  const event = new CustomEvent(VIEWPORT_SELECT_EVENT, { detail: id });
  try {
    (window.top ?? window).dispatchEvent(event);
  } catch {
    window.dispatchEvent(event);
  }
}

function showHud(viewport: Viewport) {
  hudTimers.forEach((t) => window.clearTimeout(t));
  const resolved = resolveViewport(viewport, getViewportState().display);
  const size = resolved.width
    ? `${resolved.width}×${resolved.height}`
    : `${window.innerWidth}×${window.innerHeight}`;
  set({ hud: { key: Date.now(), label: viewport.label, size, leaving: false } });
  hudTimers = [
    window.setTimeout(() => {
      const hud = getViewportState().hud;
      if (hud) set({ hud: { ...hud, leaving: true } });
    }, HUD_VISIBLE_MS),
    window.setTimeout(() => set({ hud: null }), HUD_VISIBLE_MS + HUD_EXIT_MS),
  ];
}

function onSelect(event: Event) {
  const id = (event as CustomEvent<string>).detail;
  const viewport = VIEWPORTS.find((v) => v.id === id);
  if (!viewport) return;
  const current = getViewportState();
  const framed = findViewport(id)?.id ?? null;
  const src = framed ? (current.src ?? window.location.href) : null;
  set({ active: framed, src });
  writeString(VIEWPORT_STORAGE_KEY, framed);
  if (id !== (current.active ?? "full")) showHud(viewport);
}

/** Starts listening for selections. Call once in the top window; returns a cleanup. */
export function listenForViewportSelection(): () => void {
  window.addEventListener(VIEWPORT_SELECT_EVENT, onSelect);
  return () => {
    window.removeEventListener(VIEWPORT_SELECT_EVENT, onSelect);
    hudTimers.forEach((t) => window.clearTimeout(t));
  };
}

export function patchDisplay(patch: Partial<DisplaySettings>) {
  const next = { ...getViewportState().display, ...patch };
  writeDisplay(next);
  set({ display: next });
}

export function setFrame(element: HTMLIFrameElement | null) {
  frame = element;
}

export function frameLoaded() {
  set({ frameVersion: getViewportState().frameVersion + 1 });
}

export function getFrameElement(): HTMLIFrameElement | null {
  return frame;
}

export function getFrameWindow(): Window | null {
  return frame?.contentWindow ?? null;
}

export function getFrameDocument(): Document | null {
  try {
    return frame?.contentDocument ?? null;
  } catch {
    return null; // cross-origin frame
  }
}

/** Test hook: forget everything so the next read starts fresh. */
export function resetViewportStore() {
  hudTimers.forEach((t) => window.clearTimeout(t));
  hudTimers = [];
  state = null;
  frame = null;
}
