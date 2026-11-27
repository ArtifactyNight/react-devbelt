import type { QueryClient } from "@tanstack/react-query";
import { definePlugin, type DevBeltPlugin } from "react-devbelt";

/**
 * TanStack Query v5 Package plugin. Pass the same `QueryClient` the app uses;
 * the plugin never creates or finds one on its own.
 *
 * Scaffold: returns an empty Plugin. The queries/mutations window, actions
 * and Debug bundle sections arrive in later tickets.
 */
export function tanstackQuery(queryClient: QueryClient): DevBeltPlugin {
  if (!queryClient || typeof queryClient.getQueryCache !== "function") {
    throw new Error("devbelt-plugin-tanstack-query: pass the app's QueryClient, e.g. tanstackQuery(queryClient).");
  }
  return definePlugin({
    id: "tanstack-query",
    name: "TanStack Query",
    icon: null,
  });
}
