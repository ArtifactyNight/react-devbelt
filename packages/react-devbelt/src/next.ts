// Server-side helper for next.config.{js,ts}. No React in here.

type WithInject = { instrumentationClientInject?: string[] };

/**
 * Next.js config wrapper that loads `react-devbelt/install` before hydration
 * (Next 16.3+), so you don't need an `instrumentation-client.ts` file.
 *
 * ```ts
 * import { withDevBelt } from "react-devbelt/next";
 * export default withDevBelt({ ...yourConfig });
 * ```
 *
 * Skip it if you pass your own plugin list: call `installDevBelt(plugins)`
 * from `instrumentation-client.ts` instead.
 */
export function withDevBelt<T extends object>(
  config: T = {} as T,
): T & WithInject {
  const existing = (config as WithInject).instrumentationClientInject ?? [];
  if (existing.includes("react-devbelt/install")) return config;
  return {
    ...config,
    instrumentationClientInject: [...existing, "react-devbelt/install"],
  };
}
