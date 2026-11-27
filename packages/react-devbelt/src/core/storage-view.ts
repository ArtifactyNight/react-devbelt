// A read-only view of the page's own storage: localStorage, sessionStorage and
// the cookies JavaScript can see. The toolbar's own `devbelt:*` keys are left
// out. Every value that reaches a person, an Agent tool or the Debug bundle
// goes through Redaction here.
import { redact } from "./redaction";

export type StorageStore = "localStorage" | "sessionStorage" | "cookies";
export const STORAGE_STORES: StorageStore[] = ["localStorage", "sessionStorage", "cookies"];

export type StorageEntry = { store: StorageStore; key: string; value: string; size: number };

const OWN_PREFIX = "devbelt:";

function readWebStorage(store: "localStorage" | "sessionStorage"): StorageEntry[] {
  try {
    const area = window[store];
    const entries: StorageEntry[] = [];
    for (let i = 0; i < area.length; i++) {
      const key = area.key(i);
      if (key === null || key.startsWith(OWN_PREFIX)) continue;
      const value = area.getItem(key) ?? "";
      entries.push({ store, key, value, size: value.length });
    }
    return entries;
  } catch {
    return []; // blocked storage (private window, sandboxed frame)
  }
}

function readCookies(): StorageEntry[] {
  try {
    return document.cookie
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const at = pair.indexOf("=");
        const key = at === -1 ? pair : pair.slice(0, at);
        const value = at === -1 ? "" : pair.slice(at + 1);
        return { store: "cookies" as const, key, value, size: value.length };
      })
      .filter((entry) => !entry.key.startsWith(OWN_PREFIX));
  } catch {
    return [];
  }
}

/** Every visible entry of the three stores, grouped in store order. */
export function readStorageEntries(): StorageEntry[] {
  if (typeof window === "undefined") return [];
  return [...readWebStorage("localStorage"), ...readWebStorage("sessionStorage"), ...readCookies()];
}

export type StorageViewOptions = {
  /** Keys matching this are Redacted. Default: the shared Redaction pattern. */
  pattern?: RegExp;
};

export const HTTP_ONLY_NOTE =
  "HttpOnly cookies cannot be seen: the browser hides them from page scripts.";

const STORE_TITLE: Record<StorageStore, string> = {
  localStorage: "localStorage",
  sessionStorage: "sessionStorage",
  cookies: "Cookies (readable)",
};

const cell = (value: string) => value.replaceAll("|", "\\|").replace(/\s+/g, " ");

function grouped(entries: StorageEntry[]) {
  return STORAGE_STORES.map((store) => ({
    store,
    entries: entries.filter((e) => e.store === store),
  }));
}

/** Markdown for an Agent tool: values, with Redacted ones reduced to name and length. */
export function formatStorageForAgent(
  entries: StorageEntry[],
  { pattern }: StorageViewOptions = {},
): string {
  const sections = grouped(entries).map(({ store, entries: list }) =>
    [
      `## ${STORE_TITLE[store]} (${list.length})`,
      list.length === 0
        ? "Empty."
        : [
            "| Key | Value |",
            "| --- | --- |",
            ...list.map((e) => `| ${cell(e.key)} | ${cell(redact(e.key, e.value, pattern))} |`),
          ].join("\n"),
    ].join("\n\n"),
  );
  return [...sections, HTTP_ONLY_NOTE].join("\n\n");
}

/**
 * The Debug bundle section: key names and sizes only. Values join in when
 * `includeValues` is set, and Redacted ones still stay hidden.
 */
export function formatStorageBundleSection(
  entries: StorageEntry[],
  { pattern, includeValues = false }: StorageViewOptions & { includeValues?: boolean } = {},
): string {
  const sections = grouped(entries).map(({ store, entries: list }) =>
    [
      `### ${STORE_TITLE[store]} (${list.length})`,
      list.length === 0
        ? "Empty."
        : [
            includeValues ? "| Key | Size | Value |" : "| Key | Size |",
            includeValues ? "| --- | --- | --- |" : "| --- | --- |",
            ...list.map(
              (e) =>
                `| ${cell(e.key)} | ${e.size}${
                  includeValues ? ` | ${cell(redact(e.key, e.value, pattern))}` : ""
                } |`,
            ),
          ].join("\n"),
    ].join("\n\n"),
  );
  return ["## Storage", ...sections, HTTP_ONLY_NOTE].join("\n\n");
}
