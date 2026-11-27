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
import { getFrameWindow, getViewportState, presetOf } from "../viewport/store";

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
  /** The Options, or a function that returns them (so one Axis can depend on another). The function may be async. */
  options:
    | readonly SwitcherOption[]
    | (() => readonly SwitcherOption[] | Promise<readonly SwitcherOption[]>);
  /** What choosing an Option means: set a cookie, call an API, write localStorage. */
  apply: (id: string) => void | Promise<void>;
  /** The id of the Option that is active now, or null when nothing is selected. May be async. */
  current: () => string | null | undefined | Promise<string | null | undefined>;
  /** Reload after `apply`. Default `true`. `false` skips it. A function replaces the reload and is called with no arguments. */
  reload?: boolean | (() => void);
};

type Current = { ok: true; id: string | undefined; pending?: boolean } | { ok: false };

type OptionsResult =
  | { status: "ready"; options: readonly SwitcherOption[] }
  | { status: "error"; message: string };

type OptionsView = OptionsResult | { status: "loading" };

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Promise<T>).then === "function"
  );
}

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
  // A function's list is read when the menu opens, not cached across opens.
  // A later duplicate id is ignored.
  let optionsView: OptionsView = { status: "loading" };
  let optionsAsync = false;
  let optionsToken = 0;
  const optionsListeners = new Set<() => void>();
  const dedupe = (all: readonly SwitcherOption[]): readonly SwitcherOption[] => {
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
  const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const publishOptions = (next: OptionsView) => {
    optionsView = next;
    for (const listener of optionsListeners) listener();
  };
  const readOptions = (): OptionsResult | Promise<OptionsResult> => {
    try {
      const all = typeof config.options === "function" ? config.options() : config.options;
      if (isPromise(all)) {
        optionsAsync = true;
        return all.then(
          (options) => ({ status: "ready", options: dedupe(options) }),
          (error) => ({ status: "error", message: messageOf(error) }),
        );
      }
      return { status: "ready", options: dedupe(all) };
    } catch (error) {
      return { status: "error", message: messageOf(error) };
    }
  };
  // Sync callers (the Debug bundle) cannot wait. An async function is read by the menu.
  const syncList = (): readonly SwitcherOption[] => {
    if (optionsView.status === "ready") return optionsView.options;
    if (typeof config.options !== "function") return dedupe(config.options);
    if (optionsAsync) return [];
    const value = readOptions();
    if (isPromise(value)) {
      void value.then((next) => publishOptions(next));
      return [];
    }
    if (value.status === "error") return [];
    return value.options;
  };
  function useOptions(generation: number): OptionsView {
    const [state, setState] = useState<OptionsView>(() =>
      typeof config.options === "function" ? { status: "loading" } : { status: "ready", options: dedupe(config.options) },
    );
    useEffect(() => {
      const listener = () => setState(optionsView);
      optionsListeners.add(listener);
      const token = ++optionsToken;
      const value = readOptions();
      const apply = (next: OptionsResult) => {
        if (token !== optionsToken) return;
        publishOptions(next);
      };
      if (isPromise(value)) {
        if (token === optionsToken) publishOptions({ status: "loading" });
        void value.then(apply);
      } else {
        apply(value);
      }
      return () => {
        optionsListeners.delete(listener);
      };
    }, [generation]);
    return state;
  }
  function OptionsNote({ state, onRetry }: { state: OptionsView; onRetry: () => void }) {
    switch (state.status) {
      case "loading":
        return <p role="status">Loading Options…</p>;
      case "error":
        return (
          <>
            <p role="alert">Could not load Options: {state.message}</p>
            <button type="button" className={menuItemClass} onClick={onRetry}>
              Retry
            </button>
          </>
        );
      case "ready":
        return null;
      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  }
  // The Item, the Window and the Status row share one settled read so an async
  // `current` updates every place that shows it.
  let settled: Current = { ok: true, id: undefined, pending: true };
  let currentToken = 0;
  const listeners = new Set<() => void>();
  const commit = (next: Current) => {
    settled = next;
    for (const listener of listeners) listener();
  };
  const loadCurrent = (): Current | Promise<Current> => {
    try {
      const value = config.current();
      if (isPromise(value)) {
        return value.then(
          (id) => ({ ok: true, id: id ?? undefined }),
          () => ({ ok: false }),
        );
      }
      return { ok: true, id: value ?? undefined };
    } catch {
      return { ok: false };
    }
  };
  const read = (): Current => {
    const value = loadCurrent();
    if (isPromise(value)) {
      void value.then((next) => commit(next));
      if (settled.ok && settled.pending) return { ok: true, id: undefined, pending: true };
      return settled;
    }
    return value;
  };
  function useCurrent(version: number): Current {
    const [current, setCurrent] = useState<Current>(() => {
      const value = loadCurrent();
      return isPromise(value) ? { ok: true, id: undefined, pending: true } : value;
    });
    useEffect(() => {
      const listener = () => setCurrent(settled);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    useEffect(() => {
      const token = ++currentToken;
      const value = loadCurrent();
      const apply = (next: Current) => {
        if (token !== currentToken) return;
        commit(next);
      };
      if (isPromise(value)) void value.then(apply);
      else apply(value);
    }, [version]);
    return current;
  }
  const labelOf = (current: Current, options: readonly SwitcherOption[]) => {
    if (!current.ok) return "Unknown";
    if (current.id === undefined) return "none";
    const match = options.find((option) => option.id === current.id);
    return match ? match.label : `Unknown (${current.id})`;
  };
  const checkedId = (current: Current, options: readonly SwitcherOption[]) =>
    current.ok && current.id !== undefined && options.some((option) => option.id === current.id)
      ? current.id
      : null;
  const debugValue = (current: Current) => {
    if (!current.ok) return "unknown (the current Option could not be read)";
    if (current.id === undefined) return "none";
    const match = syncList().find((option) => option.id === current.id);
    return match ? `${match.label} (${current.id})` : `Unknown (${current.id})`;
  };

  /** Applies an Option; resolves to an error message, or null on success. Never rejects. */
  async function choose(id: string): Promise<string | null> {
    try {
      await config.apply(id);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    if (typeof config.reload === "function") config.reload();
    else if (config.reload !== false) {
      const frame = getFrameWindow();
      if (frame && presetOf(getViewportState())) frame.location.reload();
      else window.location.reload();
    }
    return null;
  }

  function SwitcherPanel() {
    const [version, refresh] = useReducer((n: number) => n + 1, 0);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);
    const current = useCurrent(version);
    const [optionsAttempt, retryOptions] = useReducer((n: number) => n + 1, 0);
    const optionsState = useOptions(optionsAttempt);
    const options = optionsState.status === "ready" ? optionsState.options : [];
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
        <OptionsNote state={optionsState} onRetry={retryOptions} />
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checkedId(current, options) === option.id}
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
      const loaded = await readOptions();
      if (loaded.status === "error") return errorResult(`Could not load Options: ${loaded.message}`);
      if (!loaded.options.some((option) => option.id === id)) {
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
    run: async () => {
      const current = await loadCurrent();
      const loaded = await readOptions();
      if (loaded.status === "error") return errorResult(`Could not load Options: ${loaded.message}`);
      return text(
        JSON.stringify(
          loaded.options.map((option) => ({ ...option, current: current.ok && option.id === current.id })),
          null,
          2,
        ) + (current.ok ? "" : "\nThe current Option could not be read."),
      );
    },
  };

  function SwitcherStatus() {
    const current = useCurrent(0);
    const optionsState = useOptions(0);
    const options = optionsState.status === "ready" ? optionsState.options : [];
    return <span className="px-2 text-white">{labelOf(current, options)}</span>;
  }

  function SwitcherItem() {
    const [version, refresh] = useReducer((n: number) => n + 1, 0);
    const [opens, setOpens] = useState(0);
    const [optionsAttempt, retryOptions] = useReducer((n: number) => n + 1, 0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const current = useCurrent(version);
    const optionsState = useOptions(opens + optionsAttempt);
    const options = optionsState.status === "ready" ? optionsState.options : [];
    useEffect(
      () => () => {
        if (flashTimer.current !== null) clearTimeout(flashTimer.current);
      },
      [],
    );
    return (
      <Menu onOpenChange={(open) => { if (open) setOpens((n) => n + 1); }}>
        <ToolbarButton
          render={<MenuTrigger />}
          className={toolbarItemClass}
          aria-busy={busy || undefined}
        >
          <span>{name}</span>
          <span>{flash ?? labelOf(current, options)}</span>
        </ToolbarButton>
        <MenuContent side="top" sideOffset={10} className={menuContentClass}>
          {busy ? <p role="status">Switching…</p> : null}
          {error ? (
            <p role="alert" className="px-2 py-1.5 text-red-300">
              Switching failed: {error}
            </p>
          ) : null}
          <OptionsNote state={optionsState} onRetry={retryOptions} />
          <MenuRadioGroup
            aria-label={name}
            value={checkedId(current, options)}
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
            {options.map((option) => (
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
      return [{ label: name, value: debugValue(current) }];
    },
    window: {
      title: name,
      size: { width: 300, height: 280, minWidth: 220, minHeight: 160 },
      Component: SwitcherPanel,
    },
  });
}
