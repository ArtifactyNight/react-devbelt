// Shared by the viewport plugin and the network log (which tags each request
// with the viewport it was sent from). Not localized: dev-only tooling.
import { readJson, readString, writeJson } from "./storage";

export type Viewport = {
  id: string;
  label: string;
  keys: string;
  width?: number;
  height?: number;
};

export const VIEWPORTS: Viewport[] = [
  { id: "full", label: "Full", keys: "1" },
  { id: "mobile", label: "Mobile", keys: "2", width: 390, height: 844 },
  { id: "ipad", label: "iPad", keys: "3", width: 820, height: 1180 },
  { id: "macbook", label: "MacBook", keys: "4", width: 1440, height: 900 },
  { id: "pc", label: "PC", keys: "5", width: 1920, height: 1080 },
  { id: "custom", label: "Custom", keys: "6", width: 1024, height: 768 },
];

export const VIEWPORT_STORAGE_KEY = "viewport";
export const VIEWPORT_SELECT_EVENT = "devbelt:viewport-select";

export function findViewport(id: string | null | undefined) {
  return VIEWPORTS.find((v) => v.id === id && v.width) ?? null;
}

export type DisplaySettings = {
  // swap width and height of the framed viewport
  rotated: boolean;
  customWidth: number;
  customHeight: number;
  dark: boolean;
  // Grab also copies recent console errors and failed requests
  attachProblems: boolean;
};

export const DISPLAY_DEFAULTS: DisplaySettings = {
  rotated: false,
  customWidth: 1024,
  customHeight: 768,
  dark: false,
  attachProblems: true,
};

export const DISPLAY_STORAGE_KEY = "display";
export const CUSTOM_SIZE_LIMITS = { min: 200, max: 4000 };

export function readDisplay(): DisplaySettings {
  return {
    ...DISPLAY_DEFAULTS,
    ...readJson<Partial<DisplaySettings>>(DISPLAY_STORAGE_KEY, {}),
  };
}

export function writeDisplay(display: DisplaySettings) {
  writeJson(DISPLAY_STORAGE_KEY, display);
}

/** The id of the viewport the top window is framing, or null for the full page. */
export function readStoredViewport(): string | null {
  return findViewport(readString(VIEWPORT_STORAGE_KEY))?.id ?? null;
}

/** The preset with the custom size and rotation applied. */
export function resolveViewport(
  viewport: Viewport,
  display: DisplaySettings,
): Viewport {
  const base =
    viewport.id === "custom"
      ? {
          ...viewport,
          width: display.customWidth,
          height: display.customHeight,
        }
      : viewport;
  return display.rotated && base.width && base.height
    ? { ...base, width: base.height, height: base.width }
    : base;
}

/** Where a log entry came from: "Mobile 390×844", or "Full 1512×900" in the top window. */
export function describeViewport(): string {
  const size = `${window.innerWidth}×${window.innerHeight}`;
  if (window.self === window.top) return `Full ${size}`;
  return `${readStoredViewport() ? (findViewport(readString(VIEWPORT_STORAGE_KEY))?.label ?? "Frame") : "Frame"} ${size}`;
}
