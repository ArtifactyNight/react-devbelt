"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  Menu,
  MenuContent,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { ToolbarButton } from "@ui-sdk/react/toolbar";
import { ArrowLeftRightIcon, CheckIcon } from "lucide-react";

import { errorResult, text, type AgentTool } from "../../core/agent-tools";
import { definePlugin, type ToolbarApi } from "../../plugin";
import { menuIndicatorClass, menuItemClass } from "../../ui/more-menu";
import { toolbarItemClass } from "../../ui/styles";

const menuContentClass =
  "m-0 min-w-56 rounded-xl border border-white/10 bg-neutral-950 p-1 text-xs text-white shadow-2xl";
const FLASH_MS = 1_500;

const PLUGIN_ID_PREFIX = "switcher-";

/** One thing a person can choose on an Axis, e.g. a role or a tenant. */
export type SwitcherOption = {
  id: string;
  label: string;
  description?: string;
};

export type SwitcherConfig = {
  /** Axis id, unique per Switcher, e.g. `role`. The Plugin id is `switcher-role`. Also names the Agent tool `switch_<id>`. */
  id: string;
  /** Shown as the Plugin's name. Default: the id. */
  name?: string;
  /** The Options, or a function that returns them (so one Axis can depend on another). */
  options: readonly SwitcherOption[] | (() => readonly SwitcherOption[]);
  /** What choosing an Option means: set a cookie, call an API, write localStorage. */
  apply: (id: string) => void | Promise<void>;
  /** The id of the Option that is active now. */
  current: () => string | undefined;
  /** Reload the page after `apply`. Default `true`. */
  reload?: boolean;
};

type Current = { ok: true; id: string | undefined } | { ok: false };

/** One Axis the app can switch along (user, tenant, role, flag set). Opt-in. The Plugin id is `switcher-<id>`. */
export function switcher(config: SwitcherConfig) {
  const name = config.name ?? config.id;
  if (Array.isArray(config.options)) {
    const seen = new Set<string>();
    for (const option of config.options as readonly SwitcherOption[]) {
      if (seen.has(option.id)) {
        throw new Error(`devbelt: Switcher "${config.id}" has two Options with the id "${option.id}". Option ids must be unique.`);
      }
      seen.add(option.id);
    }
  }
  // A function's list is read on every use; a later duplicate id is ignored.
  const list = (): readonly SwitcherOption[] => {
    const all = typeof config.options === "function" ? config.options() : config.options;
    const seen = new Set<string>();
    return all.filter((option) => {
      if (seen.has(option.id)) {
        console.warn(`devbelt: Switcher "${config.id}" returned the Option id "${option.id}" twice; ignoring the later one.`);
        return false;
      }
      seen.add(option.id);
      return true;
    });
  };
  const read = (): Current => {
    try {
      return { ok: true, id: config.current() };
    } catch {
      return { ok: false };
    }
  };
  const labelOf = (current: Current) =>
    !current.ok
      ? "Unknown"
      : (list().find((option) => option.id === current.id)?.label ?? current.id ?? "none");

  /** Applies an Option; resolves to an error message, or null on success. Never rejects. */
  async function choose(id: string): Promise<string | null> {
    try {
      await config.apply(id);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    if (config.reload !== false) window.location.reload();
    return null;
  }

  function SwitcherPanel() {
    const [, refresh] = useReducer((n: number) => n + 1, 0);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);
    const current = read();
    return (
      <div role="radiogroup" aria-label={name} className="flex flex-col gap-1 p-2">
        {!current.ok ? (
          <p className="px-2 text-xs text-white/60">The current Option could not be read.</p>
        ) : null}
        {error ? (
          <p role="alert" className="px-2 text-xs text-red-300">
            Switching failed: {error}
          </p>
        ) : null}
        {list().map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={current.ok && option.id === current.id}
            className="flex flex-col rounded-md px-2 py-1.5 text-left text-xs text-white hover:bg-white/10 aria-checked:bg-white/15"
            onClick={() => {
              if (busy.current || (current.ok && option.id === current.id)) return;
              busy.current = true;
              void choose(option.id).then((problem) => {
                busy.current = false;
                setError(problem);
                refresh();
              });
            }}
          >
            <span>{option.label}</span>
            {option.description ? (
              <span className="text-white/60">{option.description}</span>
            ) : null}
          </button>
        ))}
      </div>
    );
  }

  const switchTool: AgentTool<ToolbarApi> = {
    name: `switch_${config.id}`,
    description: `Switch ${name} to another Option (list_${config.id}_options shows the ids). Reloads the page unless the app turned that off.`,
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Option id" } },
      required: ["id"],
    },
    writes: true,
    annotations: { readOnlyHint: false },
    run: async (input) => {
      const id = String(input.id ?? "");
      if (!list().some((option) => option.id === id)) {
        return errorResult(`"${id}" is not an Option of ${name}.`);
      }
      const problem = await choose(id);
      if (problem) return errorResult(`Switching ${name} to "${id}" failed: ${problem}. Nothing changed.`);
      return text(`${name} switched to "${id}".`);
    },
  };

  const listTool: AgentTool<ToolbarApi> = {
    name: `list_${config.id}_options`,
    description: `List the Options of ${name} and which one is current.`,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: () => {
      const current = read();
      return text(
        JSON.stringify(
          list().map((option) => ({ ...option, current: current.ok && option.id === current.id })),
          null,
          2,
        ) + (current.ok ? "" : "\nThe current Option could not be read."),
      );
    },
  };

  function SwitcherStatus() {
    return <span className="px-2 text-white">{labelOf(read())}</span>;
  }

  function SwitcherItem() {
    const [, refresh] = useReducer((n: number) => n + 1, 0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const current = read();
    useEffect(
      () => () => {
        if (flashTimer.current !== null) clearTimeout(flashTimer.current);
      },
      [],
    );
    return (
      <Menu>
        <ToolbarButton
          render={<MenuTrigger />}
          className={toolbarItemClass}
          aria-busy={busy || undefined}
        >
          <span>{name}</span>
          <span>{flash ?? labelOf(current)}</span>
        </ToolbarButton>
        <MenuContent side="top" sideOffset={10} className={menuContentClass}>
          {busy ? <p role="status">Switching…</p> : null}
          {error ? (
            <p role="alert" className="px-2 py-1.5 text-red-300">
              Switching failed: {error}
            </p>
          ) : null}
          <MenuRadioGroup
            aria-label={name}
            value={current.ok ? (current.id ?? null) : null}
            onValueChange={(id) => {
              if (busy || (current.ok && id === current.id)) return;
              setBusy(true);
              void choose(id).then((problem) => {
                setBusy(false);
                setError(problem);
                if (problem) {
                  if (flashTimer.current !== null) clearTimeout(flashTimer.current);
                  setFlash(`Switching failed: ${problem}`);
                  flashTimer.current = setTimeout(() => {
                    flashTimer.current = null;
                    setFlash(null);
                  }, FLASH_MS);
                } else {
                  if (flashTimer.current !== null) clearTimeout(flashTimer.current);
                  setFlash(null);
                }
                refresh();
              });
            }}
          >
            {list().map((option) => (
              <MenuRadioItem
                key={option.id}
                value={option.id}
                disabled={busy}
                className={menuItemClass}
              >
                <MenuItemIndicator keepMounted className={menuIndicatorClass}>
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                </MenuItemIndicator>
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  {option.description ? (
                    <span className="text-white/60">{option.description}</span>
                  ) : null}
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    );
  }

  return definePlugin({
    id: `${PLUGIN_ID_PREFIX}${config.id}`,
    name,
    pinned: true,
    icon: <ArrowLeftRightIcon className="size-4" aria-hidden="true" />,
    Item: SwitcherItem,
    Status: SwitcherStatus,
    agentTools: [listTool, switchTool],
    debugContext: () => {
      const current = read();
      if (!current.ok) return [{ label: name, value: "unknown (the current Option could not be read)" }];
      const label = labelOf(current);
      const id = current.id;
      return [{ label: name, value: label === id || id === undefined ? label : `${label} (${id})` }];
    },
    window: {
      title: name,
      size: { width: 300, height: 280, minWidth: 220, minHeight: 160 },
      Component: SwitcherPanel,
    },
  });
}
