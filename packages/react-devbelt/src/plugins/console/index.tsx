"use client";

import { BugIcon } from "lucide-react";

import { clampLimit, text } from "../../core/agent-tools";
import {
  formatConsoleForAgent,
  getConsoleEntries,
  installConsoleLog,
} from "../../core/console-log";
import { definePlugin } from "../../plugin";
import { MorphText } from "../../ui/morph-text";
import { ConsolePanel, useConsoleSummary } from "./panel";

function ConsoleBadge() {
  const { total, errors } = useConsoleSummary();
  return total > 0 ? (
    <span
      className={`min-w-4 text-[10px] tabular-nums ${errors > 0 ? "text-danger-fg" : "text-warning-fg"}`}
    >
      <MorphText>{total}</MorphText>
    </span>
  ) : null;
}

function ConsoleHint() {
  const { errors, warnings } = useConsoleSummary();
  return errors + warnings > 0 ? (
    <>
      {` · ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`}
    </>
  ) : null;
}

/** console.error, console.warn, uncaught errors and unhandled rejections, with stacks. */
export function consolePlugin() {
  return definePlugin({
    id: "console",
    name: "Console",
    label: "Console errors and warnings",
    icon: <BugIcon className="size-4" aria-hidden="true" />,
    install() {
      installConsoleLog();
    },
    Badge: ConsoleBadge,
    Hint: ConsoleHint,
    window: {
      title: "Console",
      size: { width: 700, height: 400, minWidth: 420, minHeight: 220 },
      Component: ConsolePanel,
    },
    agentTools: [
      {
        name: "devbelt_get_console",
        description:
          "List console errors and warnings logged by the page (newest first) as Markdown, with stacks.",
        inputSchema: {
          type: "object",
          properties: {
            level: { type: "string", enum: ["error", "warn"] },
            limit: {
              type: "number",
              description: "How many to return, default 10, max 100",
            },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        run: (input) => {
          const entries = getConsoleEntries()
            .filter((e) => !input.level || e.level === input.level)
            .slice(0, clampLimit(input.limit, 10));
          return text(
            entries.length === 0
              ? "Nothing logged."
              : formatConsoleForAgent(entries),
          );
        },
      },
    ],
  });
}
