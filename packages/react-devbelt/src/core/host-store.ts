type Options<T> = {
  max: number;
  // sessionStorage key; omit to keep the log in memory only
  persistKey?: string;
  // how many of the newest entries to save, default all
  maxSaved?: number;
  // shrinks an entry before it is saved
  trim?: (entry: T) => T;
  // fixes an entry that was saved mid-flight, e.g. a request still pending
  revive?: (entry: T) => T;
  // publish in a microtask. Needed when adding can happen while React renders
  // (console.error), since notifying subscribers then would warn again.
  deferPublish?: boolean;
};

type State<T> = {
  entries: T[];
  nextId: number;
  listeners: Set<() => void>;
  saveTimer: number | undefined;
  saveQueued: boolean;
  publishQueued: boolean;
};

const EMPTY: never[] = [];
// Saving stringifies the whole log, so wait for a quiet moment instead of
// doing it on every request; pagehide flushes whatever is still waiting.
const SAVE_DELAY_MS = 1_000;
const IDLE_TIMEOUT_MS = 2_000;

// State lives on the top window so a log gathered inside the viewport iframe
// shows up in the toolbar, and sessionStorage keeps it across full reloads.
function hostWindow(): Window {
  try {
    if (window.top && window.top.location.origin === window.location.origin) {
      return window.top;
    }
  } catch {
    // cross-origin top: fall back to this window
  }
  return window;
}

export function createHostStore<T extends { id: number }>(
  name: string,
  options: Options<T>,
) {
  const key = `__devbeltStore:${name}`;

  function state(): State<T> {
    const host = hostWindow() as Window & { [k: string]: State<T> | undefined };
    if (!host[key]) {
      host[key] = {
        entries: load(host),
        nextId: 1,
        listeners: new Set(),
        saveTimer: undefined,
        saveQueued: false,
        publishQueued: false,
      };
      if (options.persistKey) {
        const flush = () => writeNow(host[key]!);
        host.addEventListener("pagehide", flush);
      }
      host[key].nextId =
        host[key].entries.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    }
    return host[key];
  }

  function load(host: Window): T[] {
    if (!options.persistKey) return [];
    try {
      const raw = host.sessionStorage.getItem(options.persistKey);
      const parsed = raw ? (JSON.parse(raw) as T[]) : [];
      return options.revive ? parsed.map(options.revive) : parsed;
    } catch {
      return [];
    }
  }

  function writeNow(s: State<T>) {
    if (!options.persistKey || !s.saveQueued) return;
    s.saveQueued = false;
    window.clearTimeout(s.saveTimer);
    const newest = s.entries.slice(0, options.maxSaved ?? s.entries.length);
    const trimmed = options.trim ? newest.map(options.trim) : newest;
    // Quota errors shrink the list until it fits.
    for (let keep = trimmed.length; keep >= 0; keep = Math.floor(keep / 2)) {
      try {
        hostWindow().sessionStorage.setItem(
          options.persistKey,
          JSON.stringify(trimmed.slice(0, keep)),
        );
        return;
      } catch {
        if (keep === 0) return;
      }
    }
  }

  function save(s: State<T>) {
    if (!options.persistKey) return;
    s.saveQueued = true;
    window.clearTimeout(s.saveTimer);
    s.saveTimer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => writeNow(s), {
          timeout: IDLE_TIMEOUT_MS,
        });
      } else {
        writeNow(s);
      }
    }, SAVE_DELAY_MS);
  }

  // Every write above already made a new array, which is what
  // useSyncExternalStore compares, so publishing doesn't copy again.
  function publish(s: State<T>) {
    for (const listener of s.listeners) listener();
    save(s);
  }

  function changed(s: State<T>) {
    if (!options.deferPublish) return publish(s);
    if (s.publishQueued) return;
    s.publishQueued = true;
    queueMicrotask(() => {
      s.publishQueued = false;
      publish(s);
    });
  }

  return {
    add(entry: Omit<T, "id">): number {
      const s = state();
      const id = s.nextId++;
      s.entries = [{ ...entry, id } as T, ...s.entries].slice(0, options.max);
      changed(s);
      return id;
    },
    update(id: number, patch: Partial<T>) {
      const s = state();
      s.entries = s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      changed(s);
    },
    clear() {
      const s = state();
      s.entries = [];
      changed(s);
    },
    subscribe(listener: () => void) {
      const s = state();
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
      };
    },
    getSnapshot(): T[] {
      return typeof window === "undefined" ? (EMPTY as T[]) : state().entries;
    },
    getServerSnapshot(): T[] {
      return EMPTY as T[];
    },
  };
}
