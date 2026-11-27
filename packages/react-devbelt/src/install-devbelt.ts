import { installPlugins } from "./install-plugins";
import type { DevBeltPlugin } from "./plugin";

/**
 * Starts capturing (network, console, shortcuts) for your own plugin list
 * before the app runs, so the first requests and errors are not missed. Call
 * it from Next's `instrumentation-client.ts` or the first line of your entry
 * file, with the same array you give `<DevBelt plugins>`. Does nothing in
 * production or on the server.
 *
 * Use this or `import "react-devbelt/install"`, not both: whichever runs first
 * decides each plugin's options.
 */
export function installDevBelt(plugins: readonly DevBeltPlugin[]): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return;
  }
  installPlugins(plugins);
}
