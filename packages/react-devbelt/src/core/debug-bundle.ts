import {
  formatConsoleForAgent,
  getConsoleEntries,
  type ConsoleEntry,
} from "./console-log";
import {
  formatEntryForAgent,
  getNetworkEntries,
  isFailedEntry,
  type NetworkEntry,
} from "./network-log";

/** One line of the bundle's header, e.g. `{ label: "Viewport", value: "iPad 820×1180" }`. */
export type DebugEntry = { label: string; value: string };
export type DebugContext = DebugEntry[];

const BUNDLE_LIMITS = { console: 10, failed: 5, recent: 15, body: 2_000 };
const PROBLEM_WINDOW_MS = 5 * 60_000;
const PROBLEM_LIMITS = { console: 3, failed: 3, body: 300 };

const path = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};

const statusOf = (e: NetworkEntry) =>
  e.status === null ? "pending" : e.status === 0 ? "failed" : String(e.status);

const firstLine = (text: string) => text.split("\n")[0];

/**
 * Everything an assistant needs to start debugging, in one paste: where the
 * page is, what it logged, which requests failed and what the last ones did.
 */
export function formatDebugBundle(
  context: DebugContext,
  network: NetworkEntry[] = getNetworkEntries(),
  logs: ConsoleEntry[] = getConsoleEntries(),
  now: number = Date.now(),
  extraSections: string[] = [],
): string {
  const errors = logs.filter((e) => e.level === "error").length;
  const warnings = logs.length - errors;
  const failed = network.filter(isFailedEntry);
  const sections = [
    "# Debug context",
    [
      ...context.map((entry) => `- **${entry.label}:** ${entry.value}`),
      `- **Captured:** ${new Date(now).toISOString()}`,
    ].join("\n"),
    `## Console (${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"})`,
    logs.length === 0
      ? "Nothing logged."
      : formatConsoleForAgent(logs.slice(0, BUNDLE_LIMITS.console), {
          depth: 1,
        }),
    `## Failed requests (${failed.length})`,
    failed.length === 0
      ? "None."
      : failed
          .slice(0, BUNDLE_LIMITS.failed)
          .map((entry) =>
            formatEntryForAgent(
              entry,
              {
                url: true,
                request: true,
                response: true,
                headers: false,
                context: false,
              },
              { depth: 1, bodyLimit: BUNDLE_LIMITS.body },
            ),
          )
          .join("\n\n"),
    `## Recent requests (latest ${Math.min(network.length, BUNDLE_LIMITS.recent)} of ${network.length})`,
    network.length === 0
      ? "None."
      : [
          "| Method | Path | Status | Time |",
          "| --- | --- | --- | --- |",
          ...network
            .slice(0, BUNDLE_LIMITS.recent)
            .map(
              (e) =>
                `| ${e.method} | ${path(e.url).replaceAll("|", "\\|")} | ${statusOf(e)} | ${e.duration != null ? `${e.duration} ms` : "–"} |`,
            ),
        ].join("\n"),
    ...extraSections,
  ];
  return sections.join("\n\n");
}

/**
 * A short note for the end of a Grab: console errors and failed requests from
 * the last few minutes, since the element someone points at is often the one
 * that broke. Empty when nothing went wrong.
 */
export function formatRecentProblems(
  network: NetworkEntry[] = getNetworkEntries(),
  logs: ConsoleEntry[] = getConsoleEntries(),
  now: number = Date.now(),
): string {
  const since = now - PROBLEM_WINDOW_MS;
  const errors = logs
    .filter((e) => e.level === "error" && e.at >= since)
    .slice(0, PROBLEM_LIMITS.console);
  const failed = network
    .filter((e) => isFailedEntry(e) && e.startedAt >= since)
    .slice(0, PROBLEM_LIMITS.failed);
  if (errors.length === 0 && failed.length === 0) return "";

  const lines = ["## Recent problems (last 5 minutes)"];
  if (errors.length > 0) {
    lines.push("", "### Console errors");
    for (const e of errors) {
      lines.push(
        `- ${firstLine(e.message)}${e.count > 1 ? ` (×${e.count})` : ""} — ${new Date(e.at).toISOString()}`,
      );
    }
  }
  if (failed.length > 0) {
    lines.push("", "### Failed requests");
    for (const e of failed) {
      const body = e.responseBody
        ? ` — ${e.responseBody.replace(/\s+/g, " ").slice(0, PROBLEM_LIMITS.body)}`
        : "";
      lines.push(`- ${e.method} ${path(e.url)} → ${statusOf(e)}${body}`);
    }
  }
  return lines.join("\n");
}
