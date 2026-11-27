"use client";

import { useEffect, useState } from "react";
import { RulerIcon } from "lucide-react";

import {
  DEFAULT_BREAKPOINTS,
  resolveBreakpoint,
  type Breakpoints,
} from "../../core/breakpoints";
import { definePlugin } from "../../plugin";
import {
  getViewportState,
  presetOf,
  useViewportState,
} from "../viewport/store";

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
    Status: BreakpointStatus,
    ChipStatus: BreakpointChip,
    debugContext: () => [{ label: "Breakpoint", value: describe(currentWidth()) }],
  });
}
