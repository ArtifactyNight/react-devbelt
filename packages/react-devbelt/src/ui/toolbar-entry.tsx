"use client";

import { useMemo } from "react";

import { defaultPlugins } from "../plugins";
import type { AiTool } from "../core/ai-tools";
import type { DevBeltPlugin } from "../plugin";
import ToolbarImpl from "./toolbar";
import type { Isolation } from "./toolbar-root";
import type { PanelMode } from "./use-dev-layout";

let defaults: DevBeltPlugin[] | null = null;

/** The lazy chunk: the toolbar plus the built-in plugins it falls back to. */
export default function ToolbarEntry({
  plugins,
  isolation,
  panelMode,
  aiTools,
}: {
  plugins?: readonly DevBeltPlugin[];
  isolation: Isolation;
  panelMode?: PanelMode;
  aiTools?: readonly AiTool[];
}) {
  const list = useMemo(() => plugins ?? (defaults ??= defaultPlugins()), [plugins]);
  return <ToolbarImpl plugins={list} isolation={isolation} panelMode={panelMode} aiTools={aiTools} />;
}
