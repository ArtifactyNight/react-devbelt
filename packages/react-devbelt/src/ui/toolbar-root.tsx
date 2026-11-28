"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PROPERTY_CSS, TOOLBAR_CSS } from "./styles.generated";

export type Isolation = "shadow" | "none";

const HOST_TAG = "devbelt-root";
// Tailwind declares its --tw-* variables with @property, which browsers only
// honor on the document, so those rules go into <head> once.
const PROPERTY_STYLE_ID = "devbelt-properties";

// The host sits in the page's tree, so the page's own CSS can reach it. `all:
// initial` stops inherited font and colour from leaking in, and the base font
// size keeps `rem` stable whatever the page sets on <html>.
const HOST_CSS = `:host{all:initial;display:contents;font:12px/1.5 ui-sans-serif,system-ui,sans-serif;color:var(--color-fg);-webkit-font-smoothing:antialiased}`;

function ensurePropertyStyles() {
  if (document.getElementById(PROPERTY_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PROPERTY_STYLE_ID;
  style.textContent = PROPERTY_CSS;
  document.head.append(style);
}

export type Mount = {
  container: HTMLElement;
  root: Document | ShadowRoot;
};

/**
 * Creates the element the toolbar renders into and reports it once it exists.
 * "shadow" attaches a shadow root with the compiled stylesheet, so the page's
 * CSS never touches the toolbar and the toolbar's never touches the page.
 * "none" renders into a plain div and leaves styling to the caller, who
 * imports `react-devbelt/styles.css`.
 */
export function useMount(isolation: Isolation, pluginCss: string[]): Mount | null {
  const [mount, setMount] = useState<Mount | null>(null);
  const cssKey = pluginCss.join("\n");

  useLayoutEffect(() => {
    const host = document.createElement(HOST_TAG);
    // React Grab and the page-picker skip anything under this attribute
    host.setAttribute("data-react-grab-ignore", "");
    const container = document.createElement("div");
    container.setAttribute("data-devbelt", "");
    let root: Document | ShadowRoot = document;

    if (isolation === "shadow") {
      ensurePropertyStyles();
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `${HOST_CSS}${TOOLBAR_CSS}${cssKey}`;
      shadow.append(style, container);
      root = shadow;
    } else {
      if (cssKey) {
        const style = document.createElement("style");
        style.textContent = cssKey;
        host.append(style);
      }
      host.append(container);
    }

    document.body.append(host);
    setMount({ container, root });
    return () => {
      host.remove();
      setMount(null);
    };
  }, [isolation, cssKey]);

  return mount;
}

export function ToolbarPortal({
  mount,
  children,
}: {
  mount: Mount | null;
  children: React.ReactNode;
}) {
  return mount ? createPortal(children, mount.container) : null;
}
