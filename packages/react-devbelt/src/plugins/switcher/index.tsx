"use client";

import { useReducer } from "react";
import { ArrowLeftRightIcon } from "lucide-react";

import { text, type AgentTool } from "../../core/agent-tools";
import { definePlugin, type ToolbarApi } from "../../plugin";

/** One thing a person can choose on an Axis, e.g. a role or a tenant. */
export type SwitcherOption = {
  id: string;
  label: string;
  description?: string;
};

export type SwitcherConfig = {
  /** Plugin id, unique per Axis, e.g. `role`. Also names the Agent tool `switch_<id>`. */
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

/** One Axis the app can switch along (user, tenant, role, flag set). Opt-in. */
export function switcher(config: SwitcherConfig) {
  const name = config.name ?? config.id;
  const list = () =>
    typeof config.options === "function" ? config.options() : config.options;
  const labelOf = (id: string | undefined) =>
    list().find((option) => option.id === id)?.label ?? id ?? "none";

  async function choose(id: string) {
    await config.apply(id);
    if (config.reload !== false) window.location.reload();
  }

  function SwitcherPanel() {
    const [, refresh] = useReducer((n: number) => n + 1, 0);
    const current = config.current();
    return (
      <div role="radiogroup" aria-label={name} className="flex flex-col gap-1 p-2">
        {list().map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === current}
            className="flex flex-col rounded-md px-2 py-1.5 text-left text-xs text-white hover:bg-white/10 aria-checked:bg-white/15"
            onClick={() => {
              void choose(option.id).then(refresh);
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
    run: async (input) => {
      const id = String(input.id ?? "");
      if (!list().some((option) => option.id === id)) {
        return text(`"${id}" is not an Option of ${name}.`);
      }
      await choose(id);
      return text(`${name} switched to "${id}".`);
    },
  };

  const listTool: AgentTool<ToolbarApi> = {
    name: `list_${config.id}_options`,
    description: `List the Options of ${name} and which one is current.`,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: () => {
      const current = config.current();
      return text(
        JSON.stringify(
          list().map((option) => ({ ...option, current: option.id === current })),
          null,
          2,
        ),
      );
    },
  };

  function SwitcherStatus() {
    return <span className="px-2 text-white">{labelOf(config.current())}</span>;
  }

  return definePlugin({
    id: config.id,
    name,
    pinned: false,
    icon: <ArrowLeftRightIcon className="size-4" aria-hidden="true" />,
    Status: SwitcherStatus,
    agentTools: [listTool, switchTool],
    debugContext: () => {
      const id = config.current();
      const label = labelOf(id);
      return [{ label: name, value: label === id || id === undefined ? label : `${label} (${id})` }];
    },
    window: {
      title: name,
      size: { width: 300, height: 280, minWidth: 220, minHeight: 160 },
      Component: SwitcherPanel,
    },
  });
}
