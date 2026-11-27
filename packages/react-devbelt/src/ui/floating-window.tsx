"use client";

import { bindDrag } from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import { GripHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { WindowSize } from "../plugin";
import { iconButtonClass } from "./styles";
import { clampRect, type Rect } from "./use-dev-layout";

const DRAG_THRESHOLD = 4;
const STEP = 8;
const LARGE_STEP = 40;
// above the viewport frame (9000), below Grab's picker and the dock
const BASE_Z = 9100;

type Edge = "e" | "s" | "se";

type Props = {
  id: string;
  size: WindowSize;
  title: string;
  icon: React.ReactNode;
  rect: Rect;
  // position in the stack, 0 is the back
  stack: number;
  onFocus: () => void;
  onClose: () => void;
  onRect: (rect: Rect) => void;
  children: React.ReactNode;
};

/**
 * A panel that floats over the page: drag it by its header, resize it from
 * the right edge, bottom edge or corner, click anywhere to bring it to the
 * front. Moves write CSS variables directly, so a drag costs no render.
 */
export function FloatingWindow({
  id,
  size,
  title,
  icon,
  rect,
  stack,
  onFocus,
  onClose,
  onRect,
  children,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const current = useRef(rect);
  const stop = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    current.current = rect;
  }, [rect]);
  useEffect(() => () => stop.current?.(), []);

  const paint = (next: Rect) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--x", `${next.x}px`);
    el.style.setProperty("--y", `${next.y}px`);
    el.style.setProperty("--w", `${next.width}px`);
    el.style.setProperty("--h", `${next.height}px`);
  };

  const drag = (
    event: React.PointerEvent<HTMLElement>,
    to: (from: Rect, dx: number, dy: number) => Rect,
  ) => {
    if (event.button !== 0) return;
    stop.current?.();
    const from = current.current;
    const origin = { x: event.clientX, y: event.clientY };
    let latest = from;
    stop.current = bindDrag(event.currentTarget, event.nativeEvent, {
      threshold: DRAG_THRESHOLD,
      cancelOnEscape: true,
      onMove: ({ x, y }) => {
        latest = clampRect(size, to(from, x - origin.x, y - origin.y));
        paint(latest);
      },
      onEnd: (_event, canceled) => {
        if (canceled) paint(from);
        else onRect(latest);
      },
    });
  };

  const startMove = (event: React.PointerEvent<HTMLElement>) => {
    // buttons in the header are for pressing, not dragging
    if ((event.target as HTMLElement).closest("button")) return;
    drag(event, (from, dx, dy) => ({
      ...from,
      x: from.x + dx,
      y: from.y + dy,
    }));
  };

  const startResize =
    (edge: Edge) => (event: React.PointerEvent<HTMLElement>) =>
      drag(event, (from, dx, dy) => ({
        ...from,
        width: edge.includes("e") ? from.width + dx : from.width,
        height: edge.includes("s") ? from.height + dy : from.height,
      }));

  // Alt+arrows move the window, Alt+Shift+arrows move it further, and adding
  // Ctrl resizes it, so none of it needs a pointer.
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
    onRect(
      event.ctrlKey
        ? {
            ...from,
            width: from.width + delta.x * step,
            height: from.height + delta.y * step,
          }
        : { ...from, x: from.x + delta.x * step, y: from.y + delta.y * step },
    );
  };

  const { minWidth, minHeight } = size;

  return (
    <section
      ref={ref}
      aria-label={title}
      data-react-grab-ignore
      data-devbelt-window={id}
      onPointerDownCapture={onFocus}
      className="pointer-events-auto fixed top-(--y) left-(--x) flex h-(--h) w-(--w) flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-950 text-xs text-white shadow-2xl"
      style={
        {
          "--x": `${rect.x}px`,
          "--y": `${rect.y}px`,
          "--w": `${rect.width}px`,
          "--h": `${rect.height}px`,
          minWidth,
          minHeight,
          zIndex: BASE_Z + stack,
        } as React.CSSProperties
      }
    >
      <header
        onPointerDown={startMove}
        className="flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-white/10 bg-neutral-900/60 px-2 py-1.5 select-none active:cursor-grabbing"
      >
        <Button
          aria-label={`Move ${title}`}
          title="Drag the header to move · Alt+arrows nudge · add Ctrl to resize"
          onKeyDown={onKeyDown}
          className={`${iconButtonClass} size-6 cursor-grab`}
        >
          <GripHorizontalIcon className="size-3.5" aria-hidden="true" />
        </Button>
        <span className="text-neutral-400" aria-hidden="true">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold">
          {title}
        </h2>
        <Button
          aria-label={`Close ${title}`}
          onClick={onClose}
          className={`${iconButtonClass} size-6`}
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <div
        aria-hidden="true"
        onPointerDown={startResize("e")}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize touch-none"
      />
      <div
        aria-hidden="true"
        onPointerDown={startResize("s")}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize touch-none"
      />
      <div
        aria-hidden="true"
        onPointerDown={startResize("se")}
        className="absolute right-0 bottom-0 size-3.5 cursor-nwse-resize touch-none"
      />
    </section>
  );
}
