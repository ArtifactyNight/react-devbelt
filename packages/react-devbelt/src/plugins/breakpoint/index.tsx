"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RulerIcon, SquareDashedIcon } from "lucide-react";

import {
  DEFAULT_BREAKPOINTS,
  resolveBreakpoint,
  type Breakpoints,
} from "../../core/breakpoints";
import { definePlugin } from "../../plugin";
import { toolbarItemClass } from "../../ui/styles";
import {
  getFrameDocument,
  getViewportState,
  presetOf,
  useViewportState,
} from "../viewport/store";

// The outline is a stylesheet, not per-element edits, so removing it leaves
// the page exactly as it was. Anything inside the toolbar's host, its container
// or a Window is excluded (shadow DOM already hides the toolbar's own markup).
const OUTLINE_ATTR = "data-devbelt-outline";
const SKIPPED = ["devbelt-root", "[data-devbelt]", "[data-devbelt-window]"];
const OUTLINE_CSS = `*${SKIPPED.map((s) => `:not(${s}):not(${s} *)`).join("")}{outline:1px solid rgba(239,68,68,.6)!important;outline-offset:-1px!important}`;

/** The toggle's state, one per plugin instance. */
function createOutlineStore() {
  let on = false;
  const listeners = new Set<() => void>();
  return {
    set(next: boolean) {
      on = next;
      listeners.forEach((l) => l());
    },
    use: () =>
      useSyncExternalStore(
        (l) => {
          listeners.add(l);
          return () => {
            listeners.delete(l);
          };
        },
        () => on,
        () => false,
      ),
  };
}

/** Adds the outline stylesheet to a document; returns the remover. */
function applyOutline(doc: Document): () => void {
  const style = doc.createElement("style");
  style.setAttribute(OUTLINE_ATTR, "");
  style.textContent = OUTLINE_CSS;
  (doc.head ?? doc.documentElement).append(style);
  return () => style.remove();
}

export type BreakpointOptions = {
  /**
   * Breakpoint name to minimum width (px number, or a `rem`/`px` string).
   * Default: Tailwind v4's `sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem`.
   */
  breakpoints?: Breakpoints;
};

/** The Frame's width when the viewport Plugin has one, else the window's. */
function currentWidth(): number {
  return presetOf(getViewportState())?.width ?? window.innerWidth;
}

function useWidth(): number {
  const state = useViewportState();
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return presetOf(state)?.width ?? windowWidth;
}

/** The current breakpoint and width, e.g. `md · 812px`. */
export function breakpoint(options: BreakpointOptions = {}) {
  const breakpoints = options.breakpoints ?? DEFAULT_BREAKPOINTS;
  const describe = (width: number) =>
    `${resolveBreakpoint(width, breakpoints)} · ${Math.round(width)}px`;

  const outline = createOutlineStore();

  /** Outlines every element on the page and in the Frame while on. Renders nothing. */
  function OutlineOverlay() {
    const on = outline.use();
    const { active, src, frameVersion } = useViewportState();
    useEffect(() => {
      if (!on) return;
      const offs = [document, getFrameDocument()]
        .filter((doc): doc is Document => Boolean(doc))
        .map(applyOutline);
      return () => offs.forEach((off) => off());
    }, [on, active, src, frameVersion]);
    return null;
  }

  function OutlineItem() {
    const on = outline.use();
    return (
      <button
        type="button"
        aria-label="Outline all elements"
        title="Outline all elements"
        aria-pressed={on}
        onClick={() => outline.set(!on)}
        className={`${toolbarItemClass} px-3 ${on ? "bg-white text-neutral-950 hover:bg-white [&_svg]:text-neutral-950" : ""}`}
      >
        <SquareDashedIcon className="size-4" aria-hidden="true" />
      </button>
    );
  }

  function BreakpointStatus() {
    return (
      <span className="px-2 text-white tabular-nums">{describe(useWidth())}</span>
    );
  }

  function BreakpointChip() {
    return <span className="tabular-nums">{describe(useWidth())}</span>;
  }

  return definePlugin({
    id: "breakpoint",
    name: "Breakpoint",
    pinned: false,
    icon: <RulerIcon className="size-4" aria-hidden="true" />,
    Item: OutlineItem,
    Overlay: OutlineOverlay,
    Status: BreakpointStatus,
    ChipStatus: BreakpointChip,
    debugContext: () => [{ label: "Breakpoint", value: describe(currentWidth()) }],
  });
}
