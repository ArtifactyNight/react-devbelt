import { createHostStore } from "./host-store";
import { describeViewport } from "./viewports";

export type ConsoleLevel = "error" | "warn";

export type ConsoleEntry = {
  id: number;
  level: ConsoleLevel;
  message: string;
  stack: string | null;
  at: number;
  pageUrl: string;
  viewport: string;
  // identical messages in a row collapse into one entry
  count: number;
};

const PATCHED_KEY = "__devbeltConsolePatched";
const MAX_ENTRIES = 200;
const MAX_MESSAGE = 8_000;

const log = createHostStore<ConsoleEntry>("console", {
  max: MAX_ENTRIES,
  persistKey: "devbelt:console-log",
  maxSaved: 100,
  deferPublish: true,
});

export const subscribeConsoleLog = log.subscribe;
export const getConsoleEntries = log.getSnapshot;
export const getServerConsoleEntries = log.getServerSnapshot;
export const clearConsoleLog = log.clear;

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

// console.error("Expected %s, got %d", a, b): fill the placeholders the way
// the browser console does, then append whatever is left.
export function formatConsoleArgs(args: unknown[]): string {
  const [first, ...rest] = args;
  if (typeof first !== "string" || !/%[sdifoOjc%]/.test(first)) {
    return args.map(formatArg).join(" ");
  }
  const text = first.replace(/%([sdifoOjc%])/g, (match, kind: string) => {
    if (kind === "%") return "%";
    if (rest.length === 0) return match;
    const value = rest.shift();
    if (kind === "c") return "";
    if (kind === "s")
      return typeof value === "string" ? value : formatArg(value);
    if (kind === "d" || kind === "i")
      return String(parseInt(String(value), 10));
    if (kind === "f") return String(parseFloat(String(value)));
    return formatArg(value);
  });
  return [text, ...rest.map(formatArg)].join(" ");
}

function record(level: ConsoleLevel, message: string, stack: string | null) {
  try {
    const text =
      message.length > MAX_MESSAGE
        ? `${message.slice(0, MAX_MESSAGE)}… [truncated]`
        : message;
    const [latest] = log.getSnapshot();
    if (latest && latest.level === level && latest.message === text) {
      log.update(latest.id, { count: latest.count + 1, at: Date.now() });
      return;
    }
    log.add({
      level,
      message: text,
      stack,
      at: Date.now(),
      pageUrl: window.location.href,
      viewport: describeViewport(),
      count: 1,
    });
  } catch {
    // logging must never break the page
  }
}

function callStack(): string | null {
  // drop "Error", this function and the console wrapper
  const lines = new Error().stack?.split("\n").slice(3);
  return lines && lines.length > 0 ? lines.join("\n") : null;
}

export function installConsoleLog() {
  if (typeof window === "undefined") return;
  const target = console as Console & { [PATCHED_KEY]?: boolean };
  if (target[PATCHED_KEY]) return;
  target[PATCHED_KEY] = true;

  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const err = args.find((a): a is Error => a instanceof Error);
      record(level, formatConsoleArgs(args), err?.stack ?? callStack());
      original(...args);
    };
  }

  window.addEventListener("error", (event) => {
    const where = event.filename
      ? ` (${event.filename}:${event.lineno}:${event.colno})`
      : "";
    record(
      "error",
      `Uncaught ${event.message}${where}`,
      event.error instanceof Error ? (event.error.stack ?? null) : null,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    record(
      "error",
      `Unhandled promise rejection: ${formatArg(reason)}`,
      reason instanceof Error ? (reason.stack ?? null) : null,
    );
  });
}

function fence(content: string): string {
  const longest = Math.max(
    0,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  );
  const ticks = "`".repeat(Math.max(3, longest + 1));
  return `${ticks}text\n${content}\n${ticks}`;
}

/** Markdown an AI assistant reads well, one section per entry. */
export function formatConsoleForAgent(
  entries: ConsoleEntry[],
  { depth = 0 }: { depth?: number } = {},
): string {
  const h = (level: number) => "#".repeat(level + depth);
  return entries
    .map((entry) => {
      const sections = [
        `${h(2)} console.${entry.level}${entry.count > 1 ? ` (×${entry.count})` : ""}`,
        [
          `- **Time:** ${new Date(entry.at).toISOString()}`,
          `- **Page:** ${entry.pageUrl}`,
          `- **Viewport:** ${entry.viewport}`,
        ].join("\n"),
        `${h(3)} Message\n${fence(entry.message)}`,
      ];
      if (entry.stack) sections.push(`${h(3)} Stack\n${fence(entry.stack)}`);
      return sections.join("\n\n");
    })
    .join("\n\n---\n\n");
}
