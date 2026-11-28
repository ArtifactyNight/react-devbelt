"use client";

import { memo, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@ui-sdk/react/button";
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import { CopyIcon, TrashIcon } from "lucide-react";

import {
  clearConsoleLog,
  formatConsoleForAgent,
  getConsoleEntries,
  getServerConsoleEntries,
  subscribeConsoleLog,
  type ConsoleEntry,
  type ConsoleLevel,
} from "../../core/console-log";
import { chipClass, iconButtonClass } from "../../ui/styles";

const LEVEL_CLASS: Record<ConsoleLevel, string> = {
  error: "text-danger-fg",
  warn: "text-warning-fg",
};

const firstLine = (message: string) => message.split("\n")[0];

const ConsoleRow = memo(function ConsoleRow({
  entry,
}: {
  entry: ConsoleEntry;
}) {
  const line = firstLine(entry.message);
  return (
    <ListboxItem
      value={String(entry.id)}
      label={`${entry.level} ${line}`}
      className="grid cursor-default grid-cols-[3.25rem_minmax(0,1fr)_2rem_4.5rem] items-center gap-2 rounded-md px-2 py-1 font-mono text-[11px] text-fg data-highlighted:bg-hover-subtle data-selected:bg-accent/15"
    >
      <span className={`font-semibold ${LEVEL_CLASS[entry.level]}`}>
        {entry.level}
      </span>
      <span className="truncate" title={line}>
        {line}
      </span>
      <span className="text-end tabular-nums">
        {entry.count > 1 ? `×${entry.count}` : ""}
      </span>
      <span className="text-end text-fg-secondary tabular-nums">
        {new Date(entry.at).toLocaleTimeString()}
      </span>
    </ListboxItem>
  );
});

export function useConsoleSummary() {
  const entries = useSyncExternalStore(
    subscribeConsoleLog,
    getConsoleEntries,
    getServerConsoleEntries,
  );
  const errors = entries.reduce((n, e) => (e.level === "error" ? n + 1 : n), 0);
  return { total: entries.length, errors, warnings: entries.length - errors };
}

export function ConsolePanel() {
  const entries = useSyncExternalStore(
    subscribeConsoleLog,
    getConsoleEntries,
    getServerConsoleEntries,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<ConsoleLevel | "all">("all");

  const visible = useMemo(
    () =>
      level === "all" ? entries : entries.filter((e) => e.level === level),
    [entries, level],
  );
  const selected = selectedId
    ? (entries.find((e) => String(e.id) === selectedId) ?? null)
    : null;
  const errors = entries.filter((e) => e.level === "error").length;
  const warnings = entries.length - errors;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <ToggleGroup
          aria-label="Filter by level"
          value={[level]}
          deselectable={false}
          onValueChange={([next]) => next && setLevel(next as typeof level)}
          className="flex items-center gap-1.5"
        >
          <Toggle value="all" className={chipClass}>
            All <span className="tabular-nums">{entries.length}</span>
          </Toggle>
          <Toggle value="error" className={chipClass}>
            Errors <span className="tabular-nums">{errors}</span>
          </Toggle>
          <Toggle value="warn" className={chipClass}>
            Warnings <span className="tabular-nums">{warnings}</span>
          </Toggle>
        </ToggleGroup>
        <Button
          aria-label="Copy all for AI"
          title="Copy the listed messages for an AI assistant"
          disabled={visible.length === 0}
          className={`${iconButtonClass} ms-auto disabled:opacity-40`}
          onClick={() =>
            navigator.clipboard.writeText(formatConsoleForAgent(visible))
          }
        >
          <CopyIcon className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          aria-label="Clear console"
          className={iconButtonClass}
          onClick={() => {
            clearConsoleLog();
            setSelectedId(null);
          }}
        >
          <TrashIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div
        className={`min-h-0 scrollbar-slim overflow-auto ${selected ? "max-h-[40%] shrink-0 border-b border-line" : "flex-1"}`}
      >
        {visible.length === 0 ? (
          <p className="p-3 text-fg-tertiary">
            {entries.length === 0
              ? "Nothing logged. console.error, console.warn and uncaught errors show up here."
              : "Nothing at this level."}
          </p>
        ) : (
          <Listbox
            aria-label="Console messages"
            value={selectedId}
            onValueChange={(value) =>
              setSelectedId(typeof value === "string" ? value : null)
            }
            className="p-1 outline-none"
          >
            {visible.map((entry) => (
              <ConsoleRow key={entry.id} entry={entry} />
            ))}
          </Listbox>
        )}
      </div>
      {selected ? <EntryDetail key={selected.id} entry={selected} /> : null}
    </div>
  );
}

function EntryDetail({ entry }: { entry: ConsoleEntry }) {
  return (
    <div className="min-h-0 flex-1 scrollbar-slim overflow-auto p-3">
      <div className="mb-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-fg-secondary">
          {entry.viewport} · {entry.pageUrl}
        </p>
        <Button
          aria-label="Copy message for AI"
          className={iconButtonClass}
          onClick={() =>
            navigator.clipboard.writeText(formatConsoleForAgent([entry]))
          }
        >
          <CopyIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <pre
        className={`font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap ${LEVEL_CLASS[entry.level]}`}
      >
        {entry.message}
      </pre>
      {entry.stack ? (
        <pre className="mt-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-fg-secondary">
          {entry.stack}
        </pre>
      ) : null}
    </div>
  );
}
