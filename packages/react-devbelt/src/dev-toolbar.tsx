"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";

import type { DevBeltPlugin } from "./plugin";
import type { Isolation } from "./ui/toolbar-root";

export type DevBeltProps = {
  /**
   * What the toolbar offers. Default: Viewport, Grab, Network, Console,
   * Display and Copy debug bundle. Create the array once, at module level.
   */
  plugins?: readonly DevBeltPlugin[];
  /**
   * `"shadow"` (default) renders in a shadow root with its own stylesheet, so
   * nothing leaks in or out. `"none"` renders in a plain div and expects you
   * to import `react-devbelt/styles.css`.
   */
  isolation?: Isolation;
  /** Turn the toolbar off without removing it, e.g. `enabled={!isDemo}`. Default true. */
  enabled?: boolean;
};

// Decided at build time, so a production build drops the import() and never
// emits the toolbar chunk (ui-sdk panels, highlight.js, react-grab) at all.
const ToolbarImpl =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./ui/toolbar-entry"))
    : null;

const noopSubscribe = () => () => {};

/**
 * The dev toolbar. Renders nothing in production builds and on the server.
 * Put it once in your root layout.
 */
export function DevBelt({
  plugins,
  isolation = "shadow",
  enabled = true,
}: DevBeltProps) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!ToolbarImpl || !isClient || !enabled) return null;
  return (
    <Suspense fallback={null}>
      <ToolbarImpl plugins={plugins} isolation={isolation} />
    </Suspense>
  );
}
