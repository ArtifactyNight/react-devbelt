"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "motion/react";
import { Button } from "@ui-sdk/react/button";
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
} from "@ui-sdk/react/toolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import { ChevronDownIcon, GripVerticalIcon } from "lucide-react";

import { exposedAgentTools, registerAgentTools } from "../core/agent-tools";
import type { DebugEntry } from "../core/debug-bundle";
import { readString, writeString } from "../core/storage";
import { installPlugins } from "../install-plugins";
import type { DevBeltPlugin, ToolbarApi } from "../plugin";
import { ToolbarContext } from "./context";
import { DefaultItem } from "./default-item";
import { FloatingWindow } from "./floating-window";
import { MoreMenu } from "./more-menu";
import { PluginBoundary } from "./plugin-boundary";
import { useToolbarTransition } from "./motion";
import { tooltipClass } from "./styles";
import { ToolbarPortal, useMount, type Isolation } from "./toolbar-root";
import { clampRect, defaultRect, useDevLayout } from "./use-dev-layout";
import { useDockPosition } from "./use-dock-position";

const COLLAPSE_KEY = "collapsed";
// An open ui-sdk popup (menu, popover, dialog) owns Esc until it has closed.
const OPEN_POPUP =
  '[data-slot$="-content"][data-open]:not([data-slot="tooltip-content"])';

export type ToolbarProps = {
  plugins: readonly DevBeltPlugin[];
  isolation: Isolation;
};

/**
 * Installs the plugins in this frame. Inside the viewport iframe that is all
 * it does: the toolbar itself lives in the top window.
 */
export default function ToolbarImpl({ plugins, isolation }: ToolbarProps) {
  const [embedded] = useState(() => window.self !== window.top);
  // identity of the list, so an inline `plugins={[...]}` doesn't reinstall
  const key = plugins.map((p) => p.id).join("|");

  useEffect(() => installPlugins(plugins), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return embedded ? null : <TopToolbar plugins={plugins} isolation={isolation} />;
}

function TopToolbar({ plugins, isolation }: ToolbarProps) {
  const pluginCss = useMemo(
    () => plugins.flatMap((p) => (p.styles ? [p.styles] : [])),
    [plugins],
  );
  const mount = useMount(isolation, pluginCss);

  const [collapsed, setCollapsed] = useState(
    () => readString(COLLAPSE_KEY) === "1",
  );
  const dock = useDockPosition(collapsed);
  const layout = useDevLayout(plugins);

  // Latest state for the stable API object and the Esc listener below.
  const live = useRef({ layout, plugins });
  const escapeHolds = useRef(0);
  useEffect(() => {
    live.current = { layout, plugins };
  });

  const api = useMemo<ToolbarApi | null>(
    () =>
      mount
        ? {
            container: mount.container,
            root: mount.root,
            openWindow: (id) => live.current.layout.open(id),
            closeWindow: (id) => live.current.layout.close(id),
            toggleWindow: (id) => live.current.layout.toggle(id),
            debugContext: () => collectDebugContext(live.current.plugins),
            debugSections: () =>
              live.current.plugins.flatMap((p) => {
                try {
                  return p.debugSections?.() ?? [];
                } catch {
                  return [];
                }
              }),
            holdEscape: () => {
              escapeHolds.current++;
              let released = false;
              return () => {
                if (!released) {
                  released = true;
                  escapeHolds.current--;
                }
              };
            },
          }
        : null,
    [mount],
  );

  // Tools for the browser's agent, from every plugin.
  const toolKey = plugins.map((p) => `${p.id}:${p.agent?.write === true}`).join("|");
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  useEffect(
    () =>
      registerAgentTools(
        exposedAgentTools(plugins),
        () => apiRef.current as ToolbarApi,
      ),
    [toolKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Esc closes the window in front, wherever focus is, one per press. It
  // leaves the key alone while something else should have it: an overlay that
  // holds Esc (Grab) or an open menu, popover or dialog (closes first).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const { layout: current } = live.current;
      if (escapeHolds.current > 0 || current.layout.open.length === 0) return;
      const root = mount?.root ?? document;
      if (root.querySelector(OPEN_POPUP) || document.querySelector(OPEN_POPUP)) {
        return;
      }
      event.preventDefault();
      current.close(current.layout.open[current.layout.open.length - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mount]);

  const transition = useToolbarTransition();

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      writeString(COLLAPSE_KEY, current ? "0" : "1");
      return !current;
    });

  const run = (plugin: DevBeltPlugin) => {
    if (!api) return;
    if (plugin.window) layout.open(plugin.id);
    else void plugin.run?.(api);
  };

  if (!api) return null;

  const pinned = plugins.filter((p) => layout.isPinned(p));
  const byId = new Map(plugins.map((p) => [p.id, p]));

  return (
    <ToolbarContext.Provider value={api}>
      <ToolbarPortal mount={mount}>
        {plugins.map((plugin) =>
          plugin.Overlay ? (
            <PluginBoundary key={plugin.id} plugin={plugin.id}>
              <plugin.Overlay />
            </PluginBoundary>
          ) : null,
        )}

        {layout.layout.open.map((id, index) => {
          const plugin = byId.get(id);
          if (!plugin?.window) return null;
          const { Component, size, title } = plugin.window;
          return (
            <FloatingWindow
              key={id}
              id={id}
              size={size}
              title={title ?? plugin.name}
              icon={plugin.icon}
              // clamped on every render, so a window saved on a bigger screen
              // (or after the browser shrank) never ends up out of reach
              rect={clampRect(
                size,
                layout.layout.rects[id] ?? defaultRect(size, index),
              )}
              stack={index}
              onFocus={() => layout.focus(id)}
              onClose={() => layout.close(id)}
              onRect={(rect) => layout.setRect(id, rect)}
            >
              <PluginBoundary plugin={id}>
                <Component />
              </PluginBoundary>
            </FloatingWindow>
          );
        })}

        {dock.guides.x !== null ? (
          <div
            data-react-grab-ignore
            data-dock-guide="x"
            aria-hidden="true"
            className="pointer-events-none fixed inset-y-0 z-[9999] w-px bg-sky-400/70"
            style={{ left: dock.guides.x }}
          />
        ) : null}
        {dock.guides.y !== null ? (
          <div
            data-react-grab-ignore
            data-dock-guide="y"
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 z-[9999] h-px bg-sky-400/70"
            style={{ top: dock.guides.y }}
          />
        ) : null}

        <div
          ref={dock.dockRef}
          className="pointer-events-none fixed inset-0 z-[10000] [translate:var(--dock-x)_var(--dock-y)]"
          style={
            {
              "--dock-x": `${dock.position.x}px`,
              "--dock-y": `${dock.position.y}px`,
            } as CSSProperties
          }
        >
          <motion.div
            data-react-grab-ignore
            data-dock="chip"
            initial={false}
            animate={{ bottom: collapsed ? "1rem" : "4.25rem" }}
            transition={transition}
            className="pointer-events-none fixed inset-x-0 z-[10000] mx-auto flex w-fit"
          >
            <Button
              onPointerDown={dock.startDrag}
              aria-label={collapsed ? "Show dev tools" : "Hide dev tools"}
              aria-expanded={!collapsed}
              onClick={toggleCollapsed}
              className="pointer-events-auto flex h-7 w-fit items-center justify-center gap-1.5 rounded-full border border-white/10 bg-neutral-950 px-3 text-xs font-medium text-white shadow-lg hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <motion.span
                initial={false}
                animate={{ rotate: collapsed ? 180 : 0 }}
                transition={transition}
                className="inline-flex"
              >
                <ChevronDownIcon className="size-3.5 text-neutral-400" aria-hidden="true" />
              </motion.span>
              {collapsed ? (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transition}
                  className="inline-flex items-center gap-1.5"
                >
                  {plugins.map((plugin) =>
                    plugin.ChipStatus ? (
                      <PluginBoundary key={plugin.id} plugin={plugin.id}>
                        <plugin.ChipStatus />
                      </PluginBoundary>
                    ) : null,
                  )}
                </motion.span>
              ) : null}
            </Button>
          </motion.div>

          <motion.div
            data-react-grab-ignore
            data-dock="toolbar"
            initial={false}
            animate={{ y: collapsed ? "calc(100% + 1rem)" : 0 }}
            transition={transition}
            className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] mx-auto w-fit"
          >
          <Toolbar
            aria-label="Dev tools"
            inert={collapsed}
            className="pointer-events-auto relative flex w-fit items-center gap-1 rounded-full border border-white/10 bg-neutral-950 p-1 text-xs text-white shadow-lg"
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    aria-label="Move dev tools"
                    onPointerDown={dock.startDrag}
                    onKeyDown={dock.onKeyDown}
                    onDoubleClick={dock.reset}
                  />
                }
                className="inline-flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded-full text-neutral-400 select-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400 active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
                className={tooltipClass}
              >
                Drag to move · Alt+arrows nudge · double-click to reset
              </TooltipContent>
            </Tooltip>

            {pinned.map((plugin, index) => (
              <PluginBoundary key={plugin.id} plugin={plugin.id}>
                {plugin.Item ? (
                  <plugin.Item />
                ) : (
                  <DefaultItem
                    plugin={plugin}
                    api={api}
                    open={layout.isOpen(plugin.id)}
                    onToggle={() => layout.toggle(plugin.id)}
                  />
                )}
                {plugin.separatorAfter && index < pinned.length - 1 ? (
                  <ToolbarSeparator className="mx-1 h-4 w-px bg-white/15" />
                ) : null}
              </PluginBoundary>
            ))}

            <ToolbarSeparator className="mx-1 h-4 w-px bg-white/15" />

            <MoreMenu
              plugins={plugins}
              isPinned={layout.isPinned}
              onRun={run}
              onPin={layout.setPinned}
              onReset={layout.reset}
            />

            {plugins.map((plugin) =>
              plugin.Status ? (
                <PluginBoundary key={plugin.id} plugin={plugin.id}>
                  <plugin.Status />
                </PluginBoundary>
              ) : null,
            )}
          </Toolbar>
          </motion.div>
        </div>
      </ToolbarPortal>
    </ToolbarContext.Provider>
  );
}

function collectDebugContext(plugins: readonly DevBeltPlugin[]): DebugEntry[] {
  const entries = plugins.flatMap((p) => {
    try {
      return p.debugContext?.() ?? [];
    } catch {
      return [];
    }
  });
  return entries.some((e) => e.label === "Page")
    ? entries
    : [{ label: "Page", value: window.location.href }, ...entries];
}
