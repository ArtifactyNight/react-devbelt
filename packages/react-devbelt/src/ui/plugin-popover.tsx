"use client";

import type { ReactNode } from "react";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
} from "@ui-sdk/react/popover";
import { XIcon } from "lucide-react";

import type { WindowSize } from "../plugin";
import { PluginBoundary } from "./plugin-boundary";
import { iconButtonClass } from "./styles";

const MARGIN = 8;

type Props = {
  id: string;
  title: string;
  icon: ReactNode;
  size: WindowSize;
  /** Where the popover points: the plugin's toolbar item, else the toolbar. */
  root: Document | ShadowRoot;
  onClose: () => void;
  children: ReactNode;
};

const findAnchor = (root: Document | ShadowRoot, id: string) =>
  root.querySelector(`[data-devbelt-item="${id}"]`) ??
  root.querySelector('[data-dock="toolbar"]');

// A press on the toolbar is the toolbar's to handle: its toggle closes this
// popover, and another tool's toggle replaces it.
const onToolbar = (event: Event | undefined) =>
  event
    ?.composedPath()
    .some((node) => node instanceof Element && node.hasAttribute("data-dock")) ??
  false;

/**
 * A plugin's Window shown as a popover on its toolbar item instead of a
 * floating window. Fixed at the Window's default size (or the room there is),
 * not draggable or resizable. Esc and a press outside close it.
 */
export function PluginPopover({
  id,
  title,
  icon,
  size,
  root,
  onClose,
  children,
}: Props) {
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason !== "escape-key" && onToolbar(details.event)) {
          details.cancel();
          return;
        }
        onClose();
      }}
    >
      <PopoverContent
        anchor={findAnchor(root, id)}
        side="top"
        align="center"
        sideOffset={12}
        initialFocus="content"
        data-react-grab-ignore
        data-devbelt-window={id}
        className="m-0 flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-0 text-xs text-fg shadow-2xl"
        style={{
          width: `min(${size.width}px, calc(100vw - ${MARGIN * 2}px))`,
          height: `min(${size.height}px, var(--available-height, 100vh))`,
        }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-header px-2 py-1.5">
          <span className="text-fg-icon" aria-hidden="true">
            {icon}
          </span>
          <PopoverTitle className="min-w-0 flex-1 truncate text-xs font-semibold">
            {title}
          </PopoverTitle>
          <PopoverClose
            aria-label={`Close ${title}`}
            className={`${iconButtonClass} size-6`}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </PopoverClose>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <PluginBoundary plugin={id}>{children}</PluginBoundary>
        </div>
      </PopoverContent>
    </Popover>
  );
}
