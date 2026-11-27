"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { Input } from "@ui-sdk/react/input";
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import {
  CheckIcon,
  CopyIcon,
  Maximize2Icon,
  RotateCwIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";

import {
  clearNetworkLog,
  COPY_PARTS_DEFAULT,
  formatAsCurl,
  formatAsFetch,
  formatEntryForAgent,
  getNetworkEntries,
  getServerNetworkEntries,
  prettyBody,
  replayEntry,
  subscribeNetworkLog,
  type CopyParts,
  type NetworkEntry,
} from "../../core/network-log";
import { readJson, writeJson } from "../../core/storage";
import { JsonCode } from "../../ui/json-code";
import { chipClass, iconButtonClass } from "../../ui/styles";

const METHOD_CLASS: Record<string, string> = {
  GET: "text-sky-300",
  POST: "text-emerald-300",
  PUT: "text-amber-300",
  PATCH: "text-amber-300",
  DELETE: "text-rose-300",
};

const FILTER_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function isFailed(entry: NetworkEntry) {
  return entry.status === 0 || (entry.status ?? 0) >= 400;
}

function statusLabel(entry: NetworkEntry) {
  if (entry.status === null) return "…";
  if (entry.status === 0) return "ERR";
  return String(entry.status);
}

function statusClass(entry: NetworkEntry) {
  if (entry.status === null) return "text-white/50";
  if (entry.status === 0 || entry.status >= 400) return "text-rose-300";
  if (entry.status >= 300) return "text-amber-300";
  return "text-emerald-300";
}

function displayPath(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function HeaderList({ headers }: { headers: Record<string, string> }) {
  const rows = Object.entries(headers);
  if (rows.length === 0) return <p className="text-white/50">None</p>;
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px]">
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-white/50">{name}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ value, title }: { value: string | null; title: string }) {
  const text = prettyBody(value);
  if (!text) return <p className="text-white/50">No body</p>;
  return (
    <div className="relative">
      <Dialog>
        <DialogTrigger
          aria-label={`View ${title.toLowerCase()} fullscreen`}
          className={`${iconButtonClass} sticky top-0 float-end ms-2 bg-neutral-950/80`}
        >
          <Maximize2Icon className="size-3.5" aria-hidden="true" />
        </DialogTrigger>
        <DialogContent
          data-react-grab-ignore
          className="fixed inset-4 m-0 flex h-auto max-h-none w-auto max-w-none flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-950 p-0 text-xs text-white shadow-2xl transition-[opacity,scale] duration-200 backdrop:bg-black/60 data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
              {title}
            </DialogTitle>
            <Button
              aria-label={`Copy ${title.toLowerCase()}`}
              className={iconButtonClass}
              onClick={() => navigator.clipboard.writeText(text)}
            >
              <CopyIcon className="size-3.5" aria-hidden="true" />
            </Button>
            <DialogClose aria-label="Close" className={iconButtonClass}>
              <XIcon className="size-3.5" aria-hidden="true" />
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 [&_pre]:text-[13px]">
            <JsonCode code={text} />
          </div>
        </DialogContent>
      </Dialog>
      <JsonCode code={text} />
    </div>
  );
}

const tabClass =
  "rounded-md px-2.5 py-1 text-white/60 hover:text-white data-selected:bg-white/10 data-selected:text-white focus-visible:outline-2 focus-visible:outline-sky-400";

const COPY_PARTS_KEY = "network-copy-parts";
const COPY_OPTIONS: { key: keyof CopyParts; label: string }[] = [
  { key: "url", label: "URL" },
  { key: "request", label: "Request body" },
  { key: "response", label: "Response body" },
  { key: "headers", label: "Headers" },
  { key: "context", label: "Page & viewport" },
];

const COPY_PARTS_FIRST_USE: CopyParts = {
  ...COPY_PARTS_DEFAULT,
  headers: true,
};

function readCopyParts(): CopyParts {
  const saved = readJson<Partial<CopyParts> | null>(COPY_PARTS_KEY, null);
  return saved ? { ...COPY_PARTS_DEFAULT, ...saved } : COPY_PARTS_FIRST_USE;
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

const secondaryCopyClass =
  "inline-flex h-7 flex-1 items-center justify-center rounded-md border border-white/15 font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400";

function CopyMenu({ entry }: { entry: NetworkEntry }) {
  const [parts, setParts] = useState<CopyParts>(readCopyParts);
  const none = !Object.values(parts).some(Boolean);

  const toggle = (key: keyof CopyParts, checked: boolean) =>
    setParts((current) => {
      const next = { ...current, [key]: checked };
      writeJson(COPY_PARTS_KEY, next);
      return next;
    });

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Copy request for agent"
        className={iconButtonClass}
      >
        <CopyIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        data-react-grab-ignore
        className="m-0 w-52 rounded-lg border border-white/10 bg-neutral-900 p-3 text-xs text-white shadow-xl"
      >
        <PopoverTitle className="mb-2 text-xs font-semibold">
          Copy to clipboard
        </PopoverTitle>
        <div className="mb-3 flex flex-col gap-1.5">
          {COPY_OPTIONS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5"
            >
              <Checkbox
                checked={parts[key]}
                onCheckedChange={(checked) => toggle(key, checked === true)}
                className="inline-flex size-4 items-center justify-center rounded border border-white/30 bg-transparent text-neutral-950 focus-visible:outline-2 focus-visible:outline-sky-400 data-checked:border-white data-checked:bg-white"
              >
                <CheckboxIndicator>
                  <CheckIcon className="size-3" aria-hidden="true" />
                </CheckboxIndicator>
              </Checkbox>
              {label}
            </label>
          ))}
        </div>
        <PopoverClose
          disabled={none}
          onClick={() => copyText(formatEntryForAgent(entry, parts))}
          className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-white font-medium text-neutral-950 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-40"
        >
          <CopyIcon className="size-3.5" aria-hidden="true" />
          Copy
        </PopoverClose>
        <div className="mt-2 flex gap-2">
          <PopoverClose
            aria-label="Copy as cURL"
            onClick={() => copyText(formatAsCurl(entry))}
            className={secondaryCopyClass}
          >
            cURL
          </PopoverClose>
          <PopoverClose
            aria-label="Copy as fetch"
            onClick={() => copyText(formatAsFetch(entry))}
            className={secondaryCopyClass}
          >
            fetch
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReplayButton({ entry }: { entry: NetworkEntry }) {
  const icon = <RotateCwIcon className="size-3.5" aria-hidden="true" />;
  if (entry.method === "GET") {
    return (
      <Button
        aria-label="Replay request"
        className={iconButtonClass}
        onClick={() => replayEntry(entry)}
      >
        {icon}
      </Button>
    );
  }
  // Re-sending a write can change data, so ask first.
  return (
    <AlertDialog>
      <AlertDialogTrigger
        aria-label="Replay request"
        className={iconButtonClass}
      >
        {icon}
      </AlertDialogTrigger>
      <AlertDialogBackdrop className="bg-black/60" />
      <AlertDialogContent
        data-react-grab-ignore
        className="m-0 w-[min(380px,calc(100vw-32px))] rounded-xl border border-white/10 bg-neutral-950 p-4 text-xs text-white shadow-2xl"
      >
        <AlertDialogTitle className="text-sm font-semibold">
          Replay {entry.method} {displayPath(entry.url)}?
        </AlertDialogTitle>
        <AlertDialogDescription className="mt-1 text-white/70">
          This sends the request again and may change data on the server.
        </AlertDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogClose className="inline-flex h-7 items-center rounded-md border border-white/15 px-3 font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400">
            Cancel
          </AlertDialogClose>
          <AlertDialogClose
            value="confirm"
            onClick={() => replayEntry(entry)}
            className="inline-flex h-7 items-center rounded-md bg-white px-3 font-medium text-neutral-950 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Replay
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EntryDetail({ entry }: { entry: NetworkEntry }) {
  const name = `${entry.method} ${displayPath(entry.url)}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 border-b border-white/10 px-3 py-2">
        <p className="min-w-0 flex-1 font-mono text-[11px] break-all">
          <span className={`font-semibold ${METHOD_CLASS[entry.method] ?? ""}`}>
            {entry.method}
          </span>{" "}
          {entry.url}
          <span className="block text-white/50">
            <span className={statusClass(entry)}>{statusLabel(entry)}</span>
            {entry.duration != null ? ` · ${entry.duration}ms` : ""}
            {` · ${new Date(entry.startedAt).toLocaleTimeString()}`}
          </span>
        </p>
        <ReplayButton entry={entry} />
        <CopyMenu entry={entry} />
      </div>
      <Tabs defaultValue="response" className="flex min-h-0 flex-1 flex-col">
        <TabsList
          aria-label="Request details"
          className="flex gap-1 border-b border-white/10 px-2 py-1.5"
        >
          <TabsTab value="request" className={tabClass}>
            Request
          </TabsTab>
          <TabsTab value="response" className={tabClass}>
            Response
          </TabsTab>
          <TabsTab value="headers" className={tabClass}>
            Headers
          </TabsTab>
        </TabsList>
        <TabsPanel value="request" className="min-h-0 flex-1 overflow-auto p-3">
          <Body value={entry.requestBody} title={`Request body · ${name}`} />
        </TabsPanel>
        <TabsPanel
          value="response"
          className="min-h-0 flex-1 overflow-auto p-3"
        >
          <Body value={entry.responseBody} title={`Response body · ${name}`} />
        </TabsPanel>
        <TabsPanel
          value="headers"
          className="min-h-0 flex-1 space-y-3 overflow-auto p-3"
        >
          <h3 className="font-medium text-white/70">Request</h3>
          <HeaderList headers={entry.requestHeaders} />
          <h3 className="font-medium text-white/70">Response</h3>
          <HeaderList headers={entry.responseHeaders} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

const ROW_GRID =
  "grid grid-cols-[3.25rem_minmax(0,1fr)_2.25rem_3.25rem_minmax(0,1.4fr)] items-center gap-2";

function barClass(entry: NetworkEntry) {
  if (entry.status === null) return "bg-sky-400/60 animate-pulse";
  if (entry.status === 0 || entry.status >= 400) return "bg-rose-400";
  if (entry.status >= 300) return "bg-amber-400";
  return "bg-emerald-400";
}

type Timeline = { start: number; span: number };

function buildTimeline(entries: NetworkEntry[], now: number): Timeline {
  if (entries.length === 0) return { start: 0, span: 1 };
  let start = Infinity;
  let end = -Infinity;
  for (const e of entries) {
    start = Math.min(start, e.startedAt);
    end = Math.max(end, e.startedAt + (e.duration ?? now - e.startedAt));
  }
  return { start, span: Math.max(end - start, 1) };
}

// Bars are placed with CSS variables: each row knows its own start and
// duration, the list knows the span and the clock. A new request or a tick of
// a pending one then changes the list's style, not every row.
const barStyle = {
  left: "calc(var(--start) / var(--span) * 100%)",
  width: "max(1.5%, calc(var(--dur) / var(--span) * 100%))",
};

const NetworkRow = memo(function NetworkRow({
  entry,
  origin,
}: {
  entry: NetworkEntry;
  origin: number;
}) {
  const pending = entry.duration == null;
  return (
    <ListboxItem
      value={String(entry.id)}
      label={`${entry.method} ${displayPath(entry.url)}`}
      className={`${ROW_GRID} cursor-default rounded-md px-2 py-1 font-mono text-[11px] text-white data-highlighted:bg-white/5 data-selected:bg-sky-400/15`}
    >
      <span
        className={`font-semibold ${METHOD_CLASS[entry.method] ?? "text-white"}`}
      >
        {entry.method}
      </span>
      <span className="truncate" title={entry.url}>
        {displayPath(entry.url)}
      </span>
      <span className={`text-end tabular-nums ${statusClass(entry)}`}>
        {statusLabel(entry)}
      </span>
      <span className="text-end text-white tabular-nums">
        {pending ? "" : `${entry.duration}ms`}
      </span>
      <div
        aria-hidden="true"
        className="relative h-4 overflow-hidden rounded-sm bg-white/[0.04]"
        style={
          {
            "--start": entry.startedAt - origin,
            "--dur": pending
              ? `calc(var(--now) - ${entry.startedAt - origin})`
              : entry.duration,
          } as React.CSSProperties
        }
      >
        <div
          className={`absolute inset-y-0.5 rounded-sm ${barClass(entry)}`}
          style={barStyle}
        />
      </div>
    </ListboxItem>
  );
});

function NetworkList({
  visible,
  total,
  selectedId,
  onSelect,
  selectedOpen,
}: {
  visible: NetworkEntry[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedOpen: boolean;
}) {
  // Only the open panel ticks, and only while a request is still in flight.
  const hasPending = visible.some((e) => e.status === null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!hasPending) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [hasPending]);
  const timeline = buildTimeline(visible, now);

  return (
    <>
      <div
        className={`${ROW_GRID} border-b border-white/10 px-3 py-1.5 text-[10px] tracking-wide text-white/50 uppercase`}
      >
        <span>Method</span>
        <span>Path</span>
        <span className="text-end">Status</span>
        <span className="text-end">Time</span>
        <span className="flex justify-between normal-case tabular-nums">
          <span>0</span>
          <span>{Math.round(timeline.span)}ms</span>
        </span>
      </div>
      <div
        className={`min-h-0 overflow-auto ${selectedOpen ? "max-h-[40%] shrink-0 border-b border-white/10" : "flex-1"}`}
      >
        {visible.length === 0 ? (
          <p className="p-3 text-white/50">
            {total === 0
              ? "No requests yet. API calls show up here as they happen."
              : "No requests match the filter."}
          </p>
        ) : (
          <Listbox
            aria-label="Requests"
            value={selectedId}
            onValueChange={(value) =>
              onSelect(typeof value === "string" ? value : null)
            }
            className="p-1 outline-none"
            style={
              {
                "--span": timeline.span,
                "--now": now - timeline.start,
              } as React.CSSProperties
            }
          >
            {visible.map((entry) => (
              <NetworkRow
                key={entry.id}
                entry={entry}
                origin={timeline.start}
              />
            ))}
          </Listbox>
        )}
      </div>
    </>
  );
}

export function useNetworkSummary() {
  const entries = useSyncExternalStore(
    subscribeNetworkLog,
    getNetworkEntries,
    getServerNetworkEntries,
  );
  return {
    total: entries.length,
    failed: entries.reduce((n, e) => (isFailed(e) ? n + 1 : n), 0),
  };
}

export function NetworkPanel() {
  const entries = useSyncExternalStore(
    subscribeNetworkLog,
    getNetworkEntries,
    getServerNetworkEntries,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [methods, setMethods] = useState<string[]>([]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!errorsOnly || isFailed(e)) &&
        (methods.length === 0 || methods.includes(e.method)) &&
        (!needle ||
          `${e.method} ${e.url} ${e.status ?? ""}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [entries, query, errorsOnly, methods]);

  const selected = selectedId
    ? (entries.find((e) => String(e.id) === selectedId) ?? null)
    : null;
  const failed = entries.reduce((n, e) => (isFailed(e) ? n + 1 : n), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-white tabular-nums">
          {visible.length === entries.length
            ? `${entries.length} requests`
            : `${visible.length} / ${entries.length} requests`}
        </span>
        <Input
          aria-label="Filter requests"
          placeholder="Filter by method, URL or status"
          value={query}
          onValueChange={(value) => setQuery(value)}
          className="ms-auto h-7 w-56 min-w-0 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-sky-400"
        />
        <Button
          aria-label="Clear requests"
          className={iconButtonClass}
          onClick={() => {
            clearNetworkLog();
            setSelectedId(null);
          }}
        >
          <TrashIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-3 py-1.5">
        <Toggle
          aria-label="Errors only"
          pressed={errorsOnly}
          onPressedChange={setErrorsOnly}
          className={chipClass}
        >
          Errors
          <span className="tabular-nums">{failed}</span>
        </Toggle>
        <ToggleGroup
          aria-label="Filter by method"
          multiple
          value={methods}
          onValueChange={setMethods}
          className="flex flex-wrap items-center gap-1.5"
        >
          {FILTER_METHODS.map((method) => (
            <Toggle key={method} value={method} className={chipClass}>
              {method}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
      <NetworkList
        visible={visible}
        total={entries.length}
        selectedId={selectedId}
        onSelect={setSelectedId}
        selectedOpen={selected !== null}
      />
      {selected ? <EntryDetail key={selected.id} entry={selected} /> : null}
    </div>
  );
}
