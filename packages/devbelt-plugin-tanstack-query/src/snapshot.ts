import type { Mutation, Query, QueryClient } from "@tanstack/react-query";
import { isRedacted, redactedForm } from "react-devbelt/core";

export type QueryStatus = "fetching" | "paused" | "error" | "stale" | "fresh" | "inactive";
export type MutationStatus = "idle" | "pending" | "paused" | "success" | "error";

export type QueryRow = {
  key: string;
  status: QueryStatus;
  observers: number;
  fetchCount: number;
  failureCount: number;
  error: string | null;
  updatedAt: number;
};

export type MutationRow = {
  key: string;
  status: MutationStatus;
  failureCount: number;
  error: string | null;
  at: number;
};

const ERROR_CLIP = 200;

/**
 * A key's canonical text, the form shown everywhere. Values stored under a
 * secret-looking property name are Redacted: only their length is shown.
 */
export function keyText(key: readonly unknown[] | undefined): string {
  if (key === undefined) return "";
  try {
    return JSON.stringify(key, (name, value: unknown) =>
      name !== "" && isRedacted(name) && value !== null && typeof value !== "object"
        ? redactedForm(String(value))
        : value,
    );
  } catch {
    return "[unserializable key]";
  }
}

/** First line of the error message, clipped. */
export function errorText(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  const message = error instanceof Error ? error.message : String(error);
  const line = message.split("\n")[0];
  return line.length > ERROR_CLIP ? `${line.slice(0, ERROR_CLIP)}…` : line;
}

function queryStatus(query: Query): QueryStatus {
  if (query.state.fetchStatus === "fetching") return "fetching";
  if (query.state.fetchStatus === "paused") return "paused";
  if (query.state.status === "error") return "error";
  if (query.getObserversCount() === 0) return "inactive";
  return query.isStale() ? "stale" : "fresh";
}

const queryRow = (query: Query): QueryRow => ({
  key: keyText(query.queryKey),
  status: queryStatus(query),
  observers: query.getObserversCount(),
  fetchCount: query.state.dataUpdateCount + query.state.errorUpdateCount,
  failureCount: query.state.fetchFailureCount,
  error: errorText(query.state.error),
  updatedAt: Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt),
});

const mutationRow = (mutation: Mutation): MutationRow => ({
  key: keyText(mutation.options.mutationKey) || "(no key)",
  status: mutation.state.isPaused ? "paused" : mutation.state.status,
  failureCount: mutation.state.failureCount,
  error: errorText(mutation.state.error),
  at: mutation.state.submittedAt,
});

/** Failed entries first, then newest first. */
const byAttention = <T extends { status: string }>(time: (row: T) => number) =>
  (a: T, b: T) =>
    Number(b.status === "error") - Number(a.status === "error") || time(b) - time(a);

export const queryRows = (client: QueryClient): QueryRow[] =>
  client.getQueryCache().getAll().map(queryRow).sort(byAttention((r) => r.updatedAt));

export const mutationRows = (client: QueryClient): MutationRow[] =>
  client.getMutationCache().getAll().map(mutationRow).sort(byAttention((r) => r.at));

export type Summary = { failing: number; fetching: number };

export function summarize(client: QueryClient): Summary {
  let failing = 0;
  let fetching = 0;
  for (const query of client.getQueryCache().getAll()) {
    if (query.state.fetchStatus === "fetching") fetching++;
    if (query.state.status === "error") failing++;
  }
  return { failing, fetching };
}
