// Same-document writes do not fire the browser's `storage` event, so each
// frame hooks the write operations and tells the top window. Listeners live
// on the top window: a write inside the Frame reaches the Window there.

const LISTENERS = "__devbeltStorageListeners";
const PATCHED = "__devbeltStoragePatched";
// Cookies have no same-document write hook. Poll only while the Window is open.
const COOKIE_POLL_MS = 500;

type Host = Window & {
  [LISTENERS]?: Set<() => void>;
  [PATCHED]?: boolean;
};

function topWindow(): Window {
  try {
    if (window.top && window.top.location.origin === window.location.origin) return window.top;
  } catch {
    // A cross-origin top window cannot be reached. Stay in this frame.
  }
  return window;
}

function listeners(): Set<() => void> {
  const host = topWindow() as Host;
  return (host[LISTENERS] ??= new Set());
}

function notify() {
  for (const listener of listeners()) listener();
}

function cookieStoreOf(win: Window): CookieStore | null {
  try {
    const store = win.cookieStore;
    return store && typeof store.addEventListener === "function" ? store : null;
  } catch {
    return null;
  }
}

/** The Window calls this to re-read after a write in this frame or another. */
export function subscribeStorageChanges(listener: () => void): () => void {
  const set = listeners();
  set.add(listener);
  return () => set.delete(listener);
}

/**
 * Once per frame: hook `setItem`, `removeItem` and `clear`, and listen for
 * the cross-frame `storage` event. Calling it again in the same frame does
 * nothing. The returned function restores the originals.
 */
export function installStorageWatch(): () => void {
  if (typeof window === "undefined") return () => {};
  const host = window as Host;
  if (host[PATCHED]) return () => {};
  host[PATCHED] = true;

  const proto = Storage.prototype;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;
  const clear = proto.clear;

  proto.setItem = function (key: string, value: string) {
    setItem.call(this, key, value);
    notify();
  };
  proto.removeItem = function (key: string) {
    removeItem.call(this, key);
    notify();
  };
  proto.clear = function () {
    clear.call(this);
    notify();
  };

  const onStorage = () => notify();
  window.addEventListener("storage", onStorage);
  const cookies = cookieStoreOf(window);
  cookies?.addEventListener("change", onStorage);

  return () => {
    proto.setItem = setItem;
    proto.removeItem = removeItem;
    proto.clear = clear;
    window.removeEventListener("storage", onStorage);
    cookies?.removeEventListener("change", onStorage);
    host[PATCHED] = false;
  };
}

/** Polls cookies until the Window closes. No-op where the cookie change event exists. */
export function pollCookiesWhileOpen(): () => void {
  if (typeof window === "undefined" || cookieStoreOf(window)) return () => {};
  let last = document.cookie;
  const id = window.setInterval(() => {
    if (document.cookie === last) return;
    last = document.cookie;
    notify();
  }, COOKIE_POLL_MS);
  return () => window.clearInterval(id);
}
