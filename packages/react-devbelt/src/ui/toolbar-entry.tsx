"use client";

import { useMemo } from "react";

import { defaultPlugins } from "../plugins";
import type { DevBeltPlugin } from "../plugin";
import ToolbarImpl from "./toolbar";
import type { Isolation } from "./toolbar-root";

let defaults: DevBeltPlugin[] | null = null;

/** The lazy chunk: the toolbar plus the built-in plugins it falls back to. */
export default function ToolbarEntry({
  plugins,
  isolation,
}: {
  plugins?: readonly DevBeltPlugin[];
  isolation: Isolation;
}) {
  const list = useMemo(() => plugins ?? (defaults ??= defaultPlugins()), [plugins]);
  return <ToolbarImpl plugins={list} isolation={isolation} />;
}
