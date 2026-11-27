// A view of the page's own storage, plus edit, delete and clear: localStorage, sessionStorage and
// the cookies JavaScript can see. The toolbar's own `devbelt:*` keys are left
// out. Every value that reaches a person, an Agent tool or the Debug bundle
// goes through Redaction here.
import { redact } from "./redaction";

export type StorageStore = "localStorage" | "sessionStorage" | "cookies";
export const STORAGE_STORES: StorageStore[] = ["localStorage", "sessionStorage", "cookies"];

export type StorageEntry = { store: StorageStore; key: string; value: string; size: number };

const OWN_PREFIX = "devbelt:";

export type StorageUnavailable = Partial<Record<StorageStore, string>>;

const reasonOf = (e: unknown) => (e instanceof Error && e.message ? e.message : "blocked by the browser");

function readWebStorage(store: "localStorage" | "sessionStorage", unavailable: StorageUnavailable): StorageEntry[] {
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
  } catch (e) {
    unavailable[store] = reasonOf(e); // blocked storage (private window, sandboxed frame)
    return [];
  }
}

function readCookies(unavailable: StorageUnavailable): StorageEntry[] {
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
  } catch (e) {
    unavailable.cookies = reasonOf(e);
    return [];
  }
}

export type StorageState = { entries: StorageEntry[]; unavailable: StorageUnavailable };

/** Every visible entry of the three stores, plus which stores could not be read and why. */
export function readStorageState(): StorageState {
  const unavailable: StorageUnavailable = {};
  if (typeof window === "undefined") return { entries: [], unavailable };
  const entries = [
    ...readWebStorage("localStorage", unavailable),
    ...readWebStorage("sessionStorage", unavailable),
    ...readCookies(unavailable),
  ];
  return { entries, unavailable };
}

/** Every visible entry of the three stores, grouped in store order. */
export function readStorageEntries(): StorageEntry[] {
  return readStorageState().entries;
}

export type StorageViewOptions = {
  /** Keys matching this are Redacted. Default: the shared Redaction pattern. */
  pattern?: RegExp;
  /** Stores that could not be read; they are reported instead of shown as empty. */
  unavailable?: StorageUnavailable;
  /** Stores to include. Default: localStorage, sessionStorage and cookies. */
  stores?: readonly StorageStore[];
};

/** The stores a plugin instance shows, in the order given, with unknowns and duplicates dropped. */
export function resolveStorageStores(stores?: readonly StorageStore[]): StorageStore[] {
  if (!stores) return STORAGE_STORES;
  const seen = new Set<StorageStore>();
  const resolved: StorageStore[] = [];
  for (const store of stores) {
    if (!STORAGE_STORES.includes(store) || seen.has(store)) continue;
    seen.add(store);
    resolved.push(store);
  }
  return resolved;
}

export const AGENT_DEFAULT_LIMIT = 50;
export const AGENT_MAX_LIMIT = 100;

export const HTTP_ONLY_NOTE =
  "HttpOnly cookies cannot be seen: the browser hides them from page scripts.";

export const COOKIE_PATH_NOTE =
  "Editing or clearing a cookie sets it for the whole site (path /). A cookie of the same name on another path is not affected, and the original's other attributes cannot be read or preserved.";

const STORE_TITLE: Record<StorageStore, string> = {
  localStorage: "localStorage",
  sessionStorage: "sessionStorage",
  cookies: "Cookies (readable)",
};

const cell = (value: string) => value.replaceAll("|", "\\|").replace(/\s+/g, " ");

function grouped(entries: StorageEntry[], stores: readonly StorageStore[]) {
  return stores.map((store) => ({
    store,
    entries: entries.filter((e) => e.store === store),
  }));
}

const unavailableLine = (reason: string) => `Unavailable: ${reason}.`;

/**
 * Markdown for an Agent tool: values, with Redacted ones reduced to name and
 * length. Narrow with `store` and `prefix`; at most `limit` entries (default
 * 50, never more than 100) are listed.
 */
export function formatStorageForAgent(
  entries: StorageEntry[],
  {
    pattern,
    unavailable = {},
    store,
    prefix,
    limit,
    stores = STORAGE_STORES,
  }: StorageViewOptions & { store?: StorageStore; prefix?: string; limit?: number } = {},
): string {
  const allowed = stores.filter((item) => !store || item === store);
  const matching = entries.filter(
    (e) => allowed.includes(e.store) && (!prefix || e.key.startsWith(prefix)),
  );
  const max = Math.min(
    typeof limit === "number" && limit > 0 ? Math.floor(limit) : AGENT_DEFAULT_LIMIT,
    AGENT_MAX_LIMIT,
  );
  const shown = matching.slice(0, max);
  const sections = grouped(shown, allowed)
    .map(({ store: s, entries: list }) =>
      [
        `## ${STORE_TITLE[s]} (${list.length})`,
        unavailable[s] !== undefined
          ? unavailableLine(unavailable[s])
          : list.length === 0
            ? "Empty."
            : [
                "| Key | Value |",
                "| --- | --- |",
                ...list.map((e) => `| ${cell(e.key)} | ${cell(redact(e.key, e.value, pattern))} |`),
              ].join("\n"),
      ].join("\n\n"),
    );
  const note =
    shown.length < matching.length ? [`Showing ${shown.length} of ${matching.length} entries.`] : [];
  return [...sections, ...note, HTTP_ONLY_NOTE].join("\n\n");
}

/**
 * The Debug bundle section: key names and sizes only. Values join in when
 * `includeValues` is set, and Redacted ones still stay hidden.
 */
export function formatStorageBundleSection(
  entries: StorageEntry[],
  {
    pattern,
    unavailable = {},
    includeValues = false,
    stores = STORAGE_STORES,
  }: StorageViewOptions & { includeValues?: boolean } = {},
): string {
  const sections = grouped(entries, stores).map(({ store, entries: list }) =>
    [
      `### ${STORE_TITLE[store]} (${list.length})`,
      unavailable[store] !== undefined
        ? unavailableLine(unavailable[store])
        : list.length === 0
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
