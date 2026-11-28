"use client";

import { useState } from "react";

import { readJson, writeJson } from "../core/storage";
import type { DevBeltPlugin, WindowSize } from "../plugin";

export type Rect = { x: number; y: number; width: number; height: number };

/** How a plugin's panel opens: a floating window, or a popover on its toolbar item. */
export type PanelMode = "window" | "popover";

export type DevLayout = {
  // plugin id -> pinned or not, only where it differs from the plugin's default
  pinned: Record<string, boolean>;
  // plugin ids; last is in front. A popover shows one at a time.
  open: string[];
  rects: Record<string, Rect>;
  // the person's choice; absent until they make one, so the app's default applies
  mode?: PanelMode;
};

const isPanelMode = (value: unknown): value is PanelMode =>
  value === "window" || value === "popover";

const STORAGE_KEY = "layout";
const MARGIN = 8;
// how much of a window must stay on screen so it can always be grabbed
const KEEP_VISIBLE = 96;
const CASCADE = 28;

const DEFAULT_LAYOUT: DevLayout = { pinned: {}, open: [], rects: {} };

function isRect(value: unknown): value is Rect {
  const r = value as Rect | null;
  return (
    !!r &&
    [r.x, r.y, r.width, r.height].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  );
}

function read(windows: ReadonlySet<string>): DevLayout {
  const parsed = readJson<Partial<DevLayout> | null>(STORAGE_KEY, null);
  if (!parsed || typeof parsed !== "object") return DEFAULT_LAYOUT;
  const rects: DevLayout["rects"] = {};
  for (const [id, rect] of Object.entries(parsed.rects ?? {})) {
    if (windows.has(id) && isRect(rect)) rects[id] = rect;
  }
  const pinned: DevLayout["pinned"] = {};
  for (const [id, value] of Object.entries(parsed.pinned ?? {})) {
    if (typeof value === "boolean") pinned[id] = value;
  }
  return {
    pinned,
    open: Array.isArray(parsed.open)
      ? parsed.open.filter((id): id is string => windows.has(id as string))
      : [],
    rects,
    ...(isPanelMode(parsed.mode) ? { mode: parsed.mode } : {}),
  };
}

export function clampRect(size: WindowSize, rect: Rect): Rect {
  const { minWidth, minHeight } = size;
  const width = Math.min(
    Math.max(rect.width, minWidth),
    window.innerWidth - MARGIN * 2,
  );
  const height = Math.min(
    Math.max(rect.height, minHeight),
    window.innerHeight - MARGIN * 2,
  );
  return {
    width,
    height,
    x: Math.min(
      Math.max(rect.x, KEEP_VISIBLE - width),
      window.innerWidth - KEEP_VISIBLE,
    ),
    y: Math.min(Math.max(rect.y, 0), window.innerHeight - 40),
  };
}

// New windows open near the middle, each a little lower and further right
// than the last so a stack of them stays readable.
export function defaultRect(size: WindowSize, index: number): Rect {
  const width = Math.min(size.width, window.innerWidth - MARGIN * 2);
  const height = Math.min(size.height, window.innerHeight - 120);
  return clampRect(size, {
    width,
    height,
    x: (window.innerWidth - width) / 2 + index * CASCADE,
    y: Math.max(
      MARGIN,
      (window.innerHeight - height) / 2 - 40 + index * CASCADE,
    ),
  });
}

export function useDevLayout(
  plugins: readonly DevBeltPlugin[],
  defaultMode: PanelMode = "window",
) {
  const sizes = new Map<string, WindowSize>();
  for (const plugin of plugins) {
    if (plugin.window) sizes.set(plugin.id, plugin.window.size);
  }
  const [layout, setLayout] = useState<DevLayout>(() =>
    read(new Set(sizes.keys())),
  );

  const update = (change: (current: DevLayout) => DevLayout) =>
    setLayout((current) => {
      const next = change(current);
      writeJson(STORAGE_KEY, next);
      return next;
    });

  const sizeOf = (id: string) => sizes.get(id);

  const open = (id: string) => {
    const size = sizeOf(id);
    if (!size) return;
    update((current) => {
      // a popover has no position of its own and shows one tool at a time
      if ((current.mode ?? defaultMode) === "popover") {
        return { ...current, open: [id] };
      }
      return {
        ...current,
        open: [...current.open.filter((w) => w !== id), id],
        rects: current.rects[id]
          ? current.rects
          : { ...current.rects, [id]: defaultRect(size, current.open.length) },
      };
    });
  };

  const close = (id: string) =>
    update((current) => ({
      ...current,
      open: current.open.filter((w) => w !== id),
    }));

  return {
    layout,
    mode: layout.mode ?? defaultMode,
    setMode: (mode: PanelMode) =>
      update((current) => ({
        ...current,
        mode,
        // switching to a popover keeps only the tool in front
        open: mode === "popover" ? current.open.slice(-1) : current.open,
      })),
    isOpen: (id: string) => layout.open.includes(id),
    isPinned: (plugin: DevBeltPlugin) =>
      layout.pinned[plugin.id] ?? plugin.pinned ?? true,
    open,
    close,
    toggle: (id: string) => (layout.open.includes(id) ? close(id) : open(id)),
    focus: (id: string) =>
      update((current) =>
        current.open[current.open.length - 1] === id
          ? current
          : { ...current, open: [...current.open.filter((w) => w !== id), id] },
      ),
    setRect: (id: string, rect: Rect) => {
      const size = sizeOf(id);
      if (!size) return;
      update((current) => ({
        ...current,
        rects: { ...current.rects, [id]: clampRect(size, rect) },
      }));
    },
    setPinned: (id: string, pinned: boolean) =>
      update((current) => ({
        ...current,
        pinned: { ...current.pinned, [id]: pinned },
      })),
    reset: () => update(() => DEFAULT_LAYOUT),
  };
}
