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

/** The hidden form of a secret in a key: its length plus a short fingerprint, so two secrets stay distinguishable. */
function hiddenKeyValue(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 0x01000193);
  return `${redactedForm(value).slice(0, -1)}, #${(h >>> 0).toString(16).padStart(8, "0").slice(0, 4)}]`;
}

/**
 * A key's canonical text, the form shown everywhere. Values stored under a
 * secret-looking property name, and the scalar that follows a secret-looking
 * string in an array (`["auth", "Bearer x"]`), are Redacted: only their length
 * and a short fingerprint are shown.
 */
export function keyText(key: readonly unknown[] | undefined): string {
  if (key === undefined) return "";
  const scalar = (v: unknown) => v !== null && typeof v !== "object" && typeof v !== "function";
  try {
    return JSON.stringify(key, function (this: unknown, name: string, value: unknown) {
      if (name === "") return value;
      if (Array.isArray(this)) {
        const before = this[Number(name) - 1];
        return Number(name) > 0 && typeof before === "string" && isRedacted(before) && scalar(value)
          ? hiddenKeyValue(String(value))
          : value;
      }
      return isRedacted(name) && scalar(value) ? hiddenKeyValue(String(value)) : value;
    });
  } catch {
    return "[unserializable key]";
  }
}

// `name: value`, `name=value` and `Bearer value` where the name looks secret.
const SECRET_ASSIGNMENT = /([\w-]+)(["']?\s*[:=]\s*["']?)([^\s"',;&]+)/g;
const SCHEME_VALUE = /\b(Bearer|Basic)\s+[\w.~+/=-]+/gi;

/** Error text with secret-looking values hidden. */
export function redactText(message: string): string {
  return message
    .replace(SCHEME_VALUE, (_m, scheme: string) => `${scheme} [redacted]`)
    .replace(SECRET_ASSIGNMENT, (match, name: string, sep: string, value: string) =>
      isRedacted(name) && !value.startsWith("[redacted") ? `${name}${sep}${redactedForm(value)}` : match,
    );
}

/** First line of the error message, Redacted and clipped. */
export function errorText(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  const message = error instanceof Error ? error.message : String(error);
  const line = redactText(message.split("\n")[0]);
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
  key: keyText(mutation.options.mutationKey),
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
