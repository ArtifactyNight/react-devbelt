import type { DevBeltPlugin } from "./plugin";

type Installed = { cleanup: () => void; refs: number };

const KEY = "__devbeltInstalled";

function registry(): Map<string, Installed> {
  const host = window as unknown as Record<string, Map<string, Installed>>;
  return (host[KEY] ??= new Map());
}

/**
 * Runs each plugin's `install` once per frame, however many times this is
 * called (a strict-mode remount, `installDevBelt` plus `<DevBelt />`).
 * The returned function lets go of this caller's hold; a plugin is cleaned up
 * when nobody holds it.
 */
export function installPlugins(plugins: readonly DevBeltPlugin[]): () => void {
  if (typeof window === "undefined") return () => {};
  const ids = new Set<string>();
  for (const { id } of plugins) {
    if (ids.has(id)) {
      throw new Error(
        `devbelt: two plugins share the id "${id}". Plugin ids must be unique.`,
      );
    }
    ids.add(id);
  }
  const installed = registry();
  const held: string[] = [];

  for (const plugin of plugins) {
    const existing = installed.get(plugin.id);
    if (existing) {
      existing.refs++;
    } else {
      let cleanup: () => void = () => {};
      try {
        cleanup = plugin.install?.() ?? (() => {});
      } catch (error) {
        // one broken plugin must not take the others down
        console.warn(`devbelt: plugin "${plugin.id}" failed to install`, error);
      }
      installed.set(plugin.id, { cleanup, refs: 1 });
    }
    held.push(plugin.id);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const id of held) {
      const entry = installed.get(id);
      if (entry && --entry.refs <= 0) {
        entry.cleanup();
        installed.delete(id);
      }
    }
  };
}
