// Everything the toolbar remembers lives under one prefix, so it never
// collides with the host app's own keys. Every access is guarded: storage can
// be blocked (private windows, sandboxed frames) and the toolbar must still run.
const PREFIX = "devbelt:";

export const storageKey = (name: string) => `${PREFIX}${name}`;

export function readString(name: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(name));
  } catch {
    return null;
  }
}

export function writeString(name: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(storageKey(name));
    else window.localStorage.setItem(storageKey(name), value);
  } catch {
    // storage unavailable; the value just won't persist
  }
}

export function readJson<T>(name: string, fallback: T): T {
  const raw = readString(name);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(name: string, value: unknown): void {
  writeString(name, JSON.stringify(value));
}
