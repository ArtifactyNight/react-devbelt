// A view of the page's own storage, plus edit, delete and clear: localStorage, sessionStorage and
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

const EXPIRED = "Thu, 01 Jan 1970 00:00:00 GMT";

function assertOwnable(key: string) {
  if (key.startsWith(OWN_PREFIX)) {
    throw new Error(`Keys starting with "${OWN_PREFIX}" belong to the toolbar and cannot be changed.`);
  }
}

/** Sets or replaces one value. Redacted values are replaced blind: nothing is read back. */
export function setStorageEntry(store: StorageStore, key: string, value: string): void {
  assertOwnable(key);
  if (store === "cookies") {
    // Cookies are read and written raw, as the browser shows them.
    if (/[;\s]/.test(key) || value.includes(";")) {
      throw new Error("A cookie name or value cannot contain ';' or whitespace in the name.");
    }
    document.cookie = `${key}=${value}; path=/`;
  } else {
    window[store].setItem(key, value);
  }
}

/** Removes one entry. */
export function deleteStorageEntry(store: StorageStore, key: string): void {
  assertOwnable(key);
  if (store === "cookies") {
    document.cookie = `${key}=; expires=${EXPIRED}; path=/`;
  } else {
    window[store].removeItem(key);
  }
}

/** Removes every visible entry of one store. The toolbar's own `devbelt:*` keys stay. */
export function clearStorageStore(store: StorageStore): void {
  for (const entry of readStorageEntries().filter((e) => e.store === store)) {
    deleteStorageEntry(store, entry.key);
  }
}
