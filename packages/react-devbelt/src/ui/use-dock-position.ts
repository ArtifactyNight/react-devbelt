"use client";

import { bindDrag } from "@ui-sdk/core";
import { useEffect, useRef, useState } from "react";

import { readJson, writeJson, writeString } from "../core/storage";

export type DockPosition = { x: number; y: number };

const STORAGE_KEY = "position";
const ORIGIN: DockPosition = { x: 0, y: 0 };
const MARGIN = 8;
const STEP = 8;
const LARGE_STEP = 40;
const DRAG_THRESHOLD = 4;
// While dragging, the dock's edges and centre are pulled to the window's when
// they come this close. The edge gap matches where the dock rests by default.
const SNAP_DISTANCE = 12;
const SNAP_EDGE_GAP = 16;

export type SnapGuides = { x: number | null; y: number | null };
const NO_GUIDES: SnapGuides = { x: null, y: null };

function read(): DockPosition {
  const parsed = readJson<Partial<DockPosition> | null>(STORAGE_KEY, null);
  return typeof parsed?.x === "number" && typeof parsed.y === "number"
    ? { x: parsed.x, y: parsed.y }
    : ORIGIN;
}

function write(position: DockPosition) {
  if (position.x === 0 && position.y === 0) writeString(STORAGE_KEY, null);
  else writeJson(STORAGE_KEY, position);
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

// Pulls one axis to the nearest of: start edge gap, end edge gap, centre. The
// box spans [lo, hi] when the dock sits at `from`, and is at `offset` now.
function snapAxis(
  offset: number,
  from: number,
  lo: number,
  hi: number,
  size: number,
): { offset: number; guide: number | null } {
  const shift = offset - from;
  const a = lo + shift;
  const b = hi + shift;
  const targets = [
    { delta: SNAP_EDGE_GAP - a, guide: SNAP_EDGE_GAP },
    { delta: size - SNAP_EDGE_GAP - b, guide: size - SNAP_EDGE_GAP },
    { delta: size / 2 - (a + b) / 2, guide: size / 2 },
  ];
  const best = targets
    .filter((t) => Math.abs(t.delta) <= SNAP_DISTANCE)
    .sort((p, q) => Math.abs(p.delta) - Math.abs(q.delta))[0];
  return best
    ? { offset: offset + best.delta, guide: best.guide }
    : { offset, guide: null };
}

/**
 * Lets the dev dock (chip + toolbar) be dragged anywhere inside the window.
 * The drag writes CSS variables straight to the dock, so it costs no render
 * per pointer move; the final position is committed to state on release.
 */
export function useDockPosition(collapsed: boolean) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<DockPosition>(read);
  const [guides, setGuides] = useState<SnapGuides>(NO_GUIDES);
  const current = useRef(position);
  const stopDrag = useRef<(() => void) | undefined>(undefined);

  const paint = (next: DockPosition) => {
    const dock = dockRef.current;
    dock?.style.setProperty("--dock-x", `${next.x}px`);
    dock?.style.setProperty("--dock-y", `${next.y}px`);
  };

  const commit = (next: DockPosition) => {
    current.current = next;
    setPosition(next);
    paint(next);
    write(next);
  };

  // What the dock occupies on screen now: the chip, plus the toolbar unless
  // it has slid out of view.
  const bounds = () => {
    const parts = dockRef.current?.querySelectorAll<HTMLElement>("[data-dock]");
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    parts?.forEach((part) => {
      if (collapsed && part.dataset.dock === "toolbar") return;
      const rect = part.getBoundingClientRect();
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    });
    return Number.isFinite(left) ? { left, top, right, bottom } : null;
  };

  // Keeps the dock inside the window, given where it is at `from`.
  const fit = (desired: DockPosition, from: DockPosition): DockPosition => {
    const box = bounds();
    if (!box) return desired;
    return {
      x: clamp(
        desired.x,
        from.x + MARGIN - box.left,
        from.x + window.innerWidth - MARGIN - box.right,
      ),
      y: clamp(
        desired.y,
        from.y + MARGIN - box.top,
        from.y + window.innerHeight - MARGIN - box.bottom,
      ),
    };
  };

  useEffect(() => {
    const onResize = () => {
      const fitted = fit(current.current, current.current);
      if (fitted.x !== current.current.x || fitted.y !== current.current.y) {
        commit(fitted);
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      stopDrag.current?.();
    };
    // fit and commit read refs and the latest collapsed state on each call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    stopDrag.current?.();
    const from = current.current;
    const box = bounds();
    const origin = { x: event.clientX, y: event.clientY };
    stopDrag.current = bindDrag(event.currentTarget, event.nativeEvent, {
      threshold: DRAG_THRESHOLD,
      cancelOnEscape: true,
      onMove: ({ x, y, event: move }) => {
        const desired = {
          x: from.x + x - origin.x,
          y: from.y + y - origin.y,
        };
        if (!box) return paint(desired);
        // Clamp against the box measured at the start, so it never feeds back.
        const clamped = {
          x: clamp(
            desired.x,
            from.x + MARGIN - box.left,
            from.x + window.innerWidth - MARGIN - box.right,
          ),
          y: clamp(
            desired.y,
            from.y + MARGIN - box.top,
            from.y + window.innerHeight - MARGIN - box.bottom,
          ),
        };
        // Holding Alt drops the magnet for a free placement.
        if (move.altKey) {
          setGuides((g) => (g.x === null && g.y === null ? g : NO_GUIDES));
          return paint(clamped);
        }
        const snapX = snapAxis(
          clamped.x,
          from.x,
          box.left,
          box.right,
          window.innerWidth,
        );
        const snapY = snapAxis(
          clamped.y,
          from.y,
          box.top,
          box.bottom,
          window.innerHeight,
        );
        paint({ x: snapX.offset, y: snapY.offset });
        setGuides((g) =>
          g.x === snapX.guide && g.y === snapY.guide
            ? g
            : { x: snapX.guide, y: snapY.guide },
        );
      },
      onEnd: (_event, canceled) => {
        setGuides(NO_GUIDES);
        if (canceled) {
          paint(from);
          return;
        }
        const x = parseFloat(
          dockRef.current?.style.getPropertyValue("--dock-x") ?? "",
        );
        const y = parseFloat(
          dockRef.current?.style.getPropertyValue("--dock-y") ?? "",
        );
        if (Number.isFinite(x) && Number.isFinite(y)) commit({ x, y });
      },
    });
  };

  // Alt+arrows nudge it (Shift for a bigger step), like ui-sdk's own move.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!event.altKey) return;
    const delta = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? LARGE_STEP : STEP;
    const from = current.current;
    commit(
      fit({ x: from.x + delta.x * step, y: from.y + delta.y * step }, from),
    );
  };

  const reset = () => commit(ORIGIN);

  return { dockRef, position, guides, startDrag, onKeyDown, reset };
}
