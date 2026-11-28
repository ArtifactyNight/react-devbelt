"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Toolbar } from "@ui-sdk/react/toolbar";

import { FluidHoverHighlight } from "./fluid-hover-highlight";
import { useFluidHover } from "./use-fluid-hover";

/**
 * The toolbar, with one hover highlight for all its buttons that glides from one
 * to the next (Fluid Functionalism's fluid hover). Plugins draw their own items, so
 * instead of each registering itself, the strip registers every enabled button inside
 * it, in DOM order, and follows the toolbar as items come and go.
 */
export function ToolbarStrip({
  children,
  ...props
}: Omit<ComponentProps<typeof Toolbar>, "children"> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(ref, { axis: "x", gapClick: false });
  const { registerItem } = hover;

  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    let known: HTMLElement[] = [];
    const sync = () => {
      const buttons = Array.from(
        strip.querySelectorAll<HTMLElement>("button:not([disabled])"),
      );
      // only what changed, so a text morph's churn doesn't make the hook re-measure
      buttons.forEach((button, index) => {
        if (known[index] !== button) registerItem(index, button);
      });
      for (let index = buttons.length; index < known.length; index++) {
        registerItem(index, null);
      }
      known = buttons;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(strip, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      known.forEach((_, index) => registerItem(index, null));
    };
  }, [registerItem]);

  return (
    <Toolbar ref={ref} {...hover.handlers} {...props}>
      <FluidHoverHighlight hover={hover} className="z-0 rounded-full" />
      {children}
    </Toolbar>
  );
}
