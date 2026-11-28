"use client";

import { useEffect, useRef, useState } from "react";

import { FluidHoverHighlight } from "./fluid-hover-highlight";
import type { ItemRect } from "./use-fluid-hover";

/**
 * One highlight for a menu that glides from row to row (Fluid Functionalism's fluid hover).
 * ui-sdk owns which row is highlighted, for the pointer and the keyboard alike, and
 * marks it `data-highlighted`; this follows that mark instead of tracking the pointer
 * itself, so arrows and hover move the same fill. Render it as the first child of
 * the menu's content, and give rows `relative` so they sit above it.
 */
export function MenuHighlight() {
  const anchor = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<ItemRect | null>(null);
  // steps when the highlight appears after having been away, so it fades in where it
  // lands instead of sliding across the menu from where it left
  const [session, setSession] = useState(0);

  useEffect(() => {
    const menu = anchor.current?.parentElement;
    if (!menu) return;
    let lit = false;
    const read = () => {
      const row = menu.querySelector<HTMLElement>("[data-highlighted]");
      if (!row) {
        if (lit) setRect(null);
        lit = false;
        return;
      }
      if (!lit) setSession((current) => current + 1);
      lit = true;
      setRect((current) => {
        const next = {
          top: row.offsetTop,
          left: row.offsetLeft,
          width: row.offsetWidth,
          height: row.offsetHeight,
        };
        return current &&
          current.top === next.top &&
          current.left === next.left &&
          current.width === next.width &&
          current.height === next.height
          ? current
          : next;
      });
    };
    const observer = new MutationObserver(read);
    observer.observe(menu, {
      attributes: true,
      attributeFilter: ["data-highlighted"],
      subtree: true,
    });
    read();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span ref={anchor} hidden />
      <FluidHoverHighlight rect={rect} session={session} className="z-0 rounded-md" />
    </>
  );
}
