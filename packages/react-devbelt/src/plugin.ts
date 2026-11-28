import type { ComponentType, ReactNode } from "react";

import type { AgentTool } from "./core/agent-tools";
import type { AiTool } from "./core/ai-tools";
import type { DebugEntry } from "./core/debug-bundle";

export type WindowSize = {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
};

/** What a plugin can ask the toolbar to do. Get it from `useToolbar()` or `run()`. */
export interface ToolbarApi {
  /** Opens the window of the plugin with this id, as a floating window or a popover (the panel mode). */
  openWindow(pluginId: string): void;
  closeWindow(pluginId: string): void;
  toggleWindow(pluginId: string): void;
  /** The lines every plugin contributes to the debug bundle's header. */
  debugContext(): DebugEntry[];
  /** The Markdown sections plugins add to the end of the debug bundle. */
  debugSections(): string[];
  /** The AI tools the app offers for "open in …" (the `aiTools` prop). Pass one to `openInAiTool`. */
  aiTools: readonly AiTool[];
  /** Overlays that handle Esc themselves call this; the returned function releases it. */
  holdEscape(): () => void;
  /**
   * Hides the toolbar, its windows and popovers (what ⌘/ does), or shows them again. For a plugin
   * that needs the screen clear, like recording it. Whoever hides it should show it again.
   */
  setHidden(hidden: boolean): void;
  /** Whether the toolbar is hidden right now. */
  isHidden(): boolean;
  /** The element the toolbar renders into: inside its shadow root, or a div on the page. */
  container: HTMLElement;
  /** The shadow root or document the toolbar lives in, for queries. */
  root: Document | ShadowRoot;
}

export interface DevBeltPlugin {
  /** Plugin API version. `definePlugin` fills it in. */
  apiVersion: 1;
  /** Unique, lowercase, e.g. `react-query`. Also the key for saved layout. */
  id: string;
  /** Shown in menus and as the default window title. */
  name: string;
  icon: ReactNode;
  /** Whether the toolbar shows this plugin by default. Default true. People can change it in More tools. */
  pinned?: boolean;
  /** Not used: the toolbar draws a divider between every two plugins. */
  separatorAfter?: boolean;

  /**
   * Runs once in every frame, including the viewport iframe, as early as
   * `installDevBelt` or the first `<DevBelt />` mount. Patch globals or
   * register shortcuts here. Return a cleanup.
   */
  install?: () => void | (() => void);
  /** Tools for the browser's agent (WebMCP) and `window.devbelt`. */
  agentTools?: AgentTool<ToolbarApi>[];
  /**
   * Agent options set by the app. Agent tools marked `writes: true` stay off
   * until `agent: { write: true }` (ADR 0003). Read-only tools are unaffected.
   */
  agent?: { write?: boolean };
  /** Lines for the header of "Copy debug bundle". */
  debugContext?: () => DebugEntry[];
  /** Whole Markdown sections for the end of the debug bundle. */
  debugSections?: () => string[];

  /**
   * The toolbar item. Without it the toolbar draws a toggle for `window`, or
   * a button for `run`. A custom item is rendered inside the toolbar.
   */
  Item?: ComponentType;
  /** A count or dot inside the default toggle. */
  Badge?: ComponentType;
  /** Extra text after the default toggle's tooltip, e.g. " · 2 failed". */
  Hint?: ComponentType;
  /** Accessible name of the default toggle or button. Default: `name`. */
  label?: string;

  /**
   * The plugin's panel: a floating, draggable, resizable window, or, in popover
   * panel mode, a popover on its toolbar item at `size.width` × `size.height`.
   */
  window?: {
    title?: string;
    size: WindowSize;
    Component: ComponentType;
  };
  /**
   * An action. Called by the default button and by More tools. A returned
   * string flashes beside the icon, e.g. "Copied".
   */
  run?: (api: ToolbarApi) => void | string | Promise<void | string>;
  /** Tooltip of the default `run` button. */
  description?: string;

  /**
   * CSS for this plugin's own markup. The toolbar's stylesheet only knows the
   * classes the built-in plugins use, so a plugin that styles itself ships it here.
   */
  styles?: string;

  /** Rendered over the page in the top window, e.g. a picker or a device frame. */
  Overlay?: ComponentType;
  /** Rendered inside the More tools menu. Use ui-sdk `Menu*` parts. */
  MenuSection?: ComponentType;
  /** Rendered at the end of the toolbar, e.g. the current frame size. */
  Status?: ComponentType;
  /** Rendered in the collapsed toolbar's chip. */
  ChipStatus?: ComponentType;
}

export type PluginConfig = Omit<DevBeltPlugin, "apiVersion"> & {
  apiVersion?: 1;
};

const ID = /^[a-z][a-z0-9-]*$/;

/** Declares a plugin. Checks the id and stamps the API version. */
export function definePlugin(config: PluginConfig): DevBeltPlugin {
  if (!ID.test(config.id)) {
    throw new Error(
      `devbelt: plugin id "${config.id}" must be lowercase letters, digits and dashes, starting with a letter.`,
    );
  }
  if (config.apiVersion !== undefined && config.apiVersion !== 1) {
    throw new Error(
      `devbelt: plugin "${config.id}" targets plugin API ${String(config.apiVersion)}, this version supports 1.`,
    );
  }
  return { ...config, apiVersion: 1 };
}
