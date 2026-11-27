import { createHostStore } from "./host-store";
import { describeViewport } from "./viewports";

export type NetworkEntry = {
  id: number;
  method: string;
  url: string;
  // null while pending, 0 when the request failed without a response
  status: number | null;
  startedAt: number;
  duration: number | null;
  // where the request was sent from, e.g. "/tickets" and "Mobile 390×844"
  pageUrl: string;
  viewport: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
};

type TrackedXhr = XMLHttpRequest & {
  __devNetwork?: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
};

const PATCHED_KEY = "__devbeltNetworkPatched";
const MAX_ENTRIES = 300;
const MAX_SAVED_ENTRIES = 100;
const MAX_SAVED_BODY = 20_000;
// A download or export can be megabytes; the panel never needs all of it.
const MAX_MEMORY_BODY = 1_000_000;

const capInMemory = (text: string | null) =>
  text && text.length > MAX_MEMORY_BODY
    ? `${text.slice(0, MAX_MEMORY_BODY)}… [truncated, ${text.length - MAX_MEMORY_BODY} more characters]`
    : text;

const clip = (text: string | null) =>
  text && text.length > MAX_SAVED_BODY
    ? `${text.slice(0, MAX_SAVED_BODY)}… [truncated]`
    : text;

const log = createHostStore<NetworkEntry>("network", {
  max: MAX_ENTRIES,
  persistKey: "devbelt:network-log",
  maxSaved: MAX_SAVED_ENTRIES,
  trim: (e) => ({
    ...e,
    requestBody: clip(e.requestBody),
    responseBody: clip(e.responseBody),
  }),
  // A request that was still in flight when the page reloaded never finished.
  revive: (e) => (e.status === null ? { ...e, status: 0 } : e),
});

const add = log.add;
const update = log.update;
export const subscribeNetworkLog = log.subscribe;
export const getNetworkEntries = log.getSnapshot;
export const getServerNetworkEntries = log.getServerSnapshot;
export const clearNetworkLog = log.clear;

export type NetworkLogOptions = {
  /**
   * Header names whose values are masked in the log (case-insensitive).
   * Defaults to credentials: authorization, cookies and API keys.
   */
  redactHeaders?: string[];
  /**
   * Decides what a replayed request sends for a header. `value` is what the
   * log holds, which is masked for redacted headers. Return the real value
   * (for example the current session's token), or null to leave it out.
   * By default redacted headers are left out of a replay.
   */
  replayHeaders?: (name: string, value: string) => string | null | undefined;
  /** Also record `fetch` calls. Default true. */
  fetch?: boolean;
};

export const DEFAULT_REDACTED_HEADERS = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
];

let redacted = new Set(DEFAULT_REDACTED_HEADERS);
let replayHeaders: NetworkLogOptions["replayHeaders"];

function applyOptions(options: NetworkLogOptions) {
  if (options.redactHeaders) {
    redacted = new Set(options.redactHeaders.map((h) => h.toLowerCase()));
  }
  if (options.replayHeaders) replayHeaders = options.replayHeaders;
}

const isRedacted = (name: string) => redacted.has(name.toLowerCase());

// Keeps the scheme and the last few characters, enough to tell two tokens
// apart without writing the credential into the log (or the page's storage).
function maskHeader(name: string, value: string) {
  if (!isRedacted(name)) return value;
  const [scheme, token] = value.split(" ");
  if (token) return `${scheme} …${token.slice(-6)}`;
  return value.length > 12 ? `…${value.slice(-4)}` : "…";
}

function serializeBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    const lines: string[] = [];
    body.forEach((value, key) => {
      lines.push(
        `${key}: ${typeof value === "string" ? value : `[File ${value.name}, ${value.size} B]`}`,
      );
    });
    return lines.join("\n");
  }
  if (body instanceof Blob)
    return `[Blob ${body.type || "binary"}, ${body.size} B]`;
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength} B]`;
  return String(body);
}

function readResponse(xhr: XMLHttpRequest): string | null {
  if (xhr.responseType === "" || xhr.responseType === "text") {
    return xhr.responseText || null;
  }
  if (xhr.responseType === "json") return JSON.stringify(xhr.response);
  if (xhr.response instanceof Blob) {
    return `[Blob ${xhr.response.type || "binary"}, ${xhr.response.size} B]`;
  }
  return `[${xhr.responseType}]`;
}

function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(":");
    if (index > 0) {
      const name = line.slice(0, index).trim().toLowerCase();
      headers[name] = maskHeader(name, line.slice(index + 1).trim());
    }
  }
  return headers;
}


const FETCH_PATCHED_KEY = "__devbeltFetchPatched";
// A stream never ends on its own; reading it would hold the response open.
const UNREADABLE_TYPES = /event-stream|octet-stream|^(audio|video|image)\//i;

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name.toLowerCase()] = maskHeader(name, value);
  });
  return out;
}

function installFetchLog() {
  if (typeof window.fetch !== "function") return;
  const target = window as Window & { [FETCH_PATCHED_KEY]?: boolean };
  if (target[FETCH_PATCHED_KEY]) return;
  target[FETCH_PATCHED_KEY] = true;

  const original = window.fetch.bind(window);
  window.fetch = async function devbeltFetch(input, init) {
    let id: number | null = null;
    const startedAt = performance.now();
    try {
      const request = new Request(input, init);
      id = add({
        method: request.method.toUpperCase(),
        url: new URL(request.url, window.location.href).href,
        status: null,
        startedAt: Date.now(),
        duration: null,
        pageUrl: window.location.href,
        viewport: describeViewport(),
        requestHeaders: headersToRecord(request.headers),
        // Only what the caller passed as `init.body` is read back; a Request
        // body is a stream and cannot be read without consuming it.
        requestBody: capInMemory(serializeBody(init?.body)),
        responseHeaders: {},
        responseBody: null,
      });
    } catch {
      // logging must never break the request
    }
    try {
      const response = await original(input, init);
      if (id !== null) {
        const entryId = id;
        const type = response.headers.get("content-type") ?? "";
        update(entryId, {
          status: response.status,
          duration: Math.round(performance.now() - startedAt),
          responseHeaders: headersToRecord(response.headers),
        });
        if (!UNREADABLE_TYPES.test(type)) {
          response
            .clone()
            .text()
            .then((text) =>
              update(entryId, { responseBody: capInMemory(text || null) }),
            )
            .catch(() => {});
        }
      }
      return response;
    } catch (error) {
      if (id !== null) {
        update(id, {
          status: 0,
          duration: Math.round(performance.now() - startedAt),
        });
      }
      throw error;
    }
  };
}

export function installNetworkLog(options: NetworkLogOptions = {}) {
  if (typeof window === "undefined") return;
  applyOptions(options);
  if (options.fetch !== false) installFetchLog();
  const proto = XMLHttpRequest.prototype as XMLHttpRequest & {
    [PATCHED_KEY]?: boolean;
  };
  if (proto[PATCHED_KEY]) return;
  proto[PATCHED_KEY] = true;

  const open = proto.open;
  const setRequestHeader = proto.setRequestHeader;
  const send = proto.send;

  proto.open = function (
    this: TrackedXhr,
    ...args: [string, string | URL, ...unknown[]]
  ) {
    const [method, url] = args;
    this.__devNetwork = {
      method: method.toUpperCase(),
      url: new URL(url, window.location.href).href,
      headers: {},
    };
    return Reflect.apply(open, this, args);
  } as XMLHttpRequest["open"];

  proto.setRequestHeader = function (
    this: TrackedXhr,
    name: string,
    value: string,
  ) {
    if (this.__devNetwork) {
      this.__devNetwork.headers[name] = maskHeader(name, value);
    }
    return setRequestHeader.call(this, name, value);
  };

  proto.send = function (
    this: TrackedXhr,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const meta = this.__devNetwork;
    if (meta) {
      const startedAt = performance.now();
      const id = add({
        method: meta.method,
        url: meta.url,
        status: null,
        startedAt: Date.now(),
        duration: null,
        pageUrl: window.location.href,
        viewport: describeViewport(),
        requestHeaders: meta.headers,
        requestBody: capInMemory(serializeBody(body)),
        responseHeaders: {},
        responseBody: null,
      });
      this.addEventListener("loadend", () => {
        update(id, {
          status: this.status,
          duration: Math.round(performance.now() - startedAt),
          responseHeaders: parseHeaders(this.getAllResponseHeaders()),
          responseBody:
            this.status === 0 ? null : capInMemory(readResponse(this)),
        });
      });
    }
    return send.call(this, body);
  };
}

export function prettyBody(body: string | null): string {
  if (body == null || body === "") return "";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export type CopyParts = {
  url: boolean;
  request: boolean;
  response: boolean;
  headers: boolean;
  context: boolean;
};

export const COPY_PARTS_DEFAULT: CopyParts = {
  url: true,
  request: true,
  response: true,
  headers: false,
  context: true,
};

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

const MAX_COPY_BODY = 20_000;

export function isFailedEntry(entry: NetworkEntry): boolean {
  return entry.status === 0 || (entry.status ?? 0) >= 400;
}

function statusText(entry: NetworkEntry): string {
  if (entry.status === null) return "pending";
  if (entry.status === 0)
    return "failed (no response: network error, CORS or aborted)";
  const text = STATUS_TEXT[entry.status];
  return text ? `${entry.status} ${text}` : String(entry.status);
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// A fence one backtick longer than any run inside, so a body that contains
// ``` can't end the block early.
function fence(content: string, language: string): string {
  const longest = Math.max(
    0,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  );
  const ticks = "`".repeat(Math.max(3, longest + 1));
  return `${ticks}${language}\n${content}\n${ticks}`;
}

// depth nests the output under a heading of the caller's, e.g. a bundle section
export type FormatOptions = { depth?: number; bodyLimit?: number };

const heading = (level: number, depth: number) => "#".repeat(level + depth);

function bodyBlock(
  title: string,
  raw: string,
  { depth = 0, bodyLimit = MAX_COPY_BODY }: FormatOptions,
): string {
  const pretty = prettyBody(raw);
  const clipped =
    pretty.length > bodyLimit
      ? `${pretty.slice(0, bodyLimit)}\n… [truncated, ${pretty.length - bodyLimit} more characters]`
      : pretty;
  return `${heading(3, depth)} ${title}\n${fence(clipped, isJson(raw) ? "json" : "text")}`;
}

function headersBlock(
  title: string,
  headers: Record<string, string>,
  depth: number,
) {
  const rows = Object.entries(headers);
  if (rows.length === 0) return null;
  return `${heading(3, depth)} ${title}\n${fence(rows.map(([n, v]) => `${n}: ${v}`).join("\n"), "http")}`;
}

/** Markdown an AI assistant reads well: facts first, then fenced sections. */
export function formatEntryForAgent(
  entry: NetworkEntry,
  parts: CopyParts = COPY_PARTS_DEFAULT,
  options: FormatOptions = {},
): string {
  const depth = options.depth ?? 0;
  const path = (() => {
    try {
      const u = new URL(entry.url);
      return `${u.pathname}${u.search}`;
    } catch {
      return entry.url;
    }
  })();
  const code = entry.status && entry.status > 0 ? ` → ${entry.status}` : "";
  const sections: string[] = [
    `${heading(2, depth)} ${entry.method} ${path}${code}`,
  ];

  const facts = [
    parts.url ? `- **URL:** ${entry.url}` : null,
    `- **Status:** ${statusText(entry)}${entry.duration != null ? ` (${entry.duration} ms)` : ""}`,
    parts.context
      ? `- **Sent at:** ${new Date(entry.startedAt).toISOString()}`
      : null,
    parts.context ? `- **Page:** ${entry.pageUrl}` : null,
    parts.context ? `- **Viewport:** ${entry.viewport}` : null,
  ].filter(Boolean);
  sections.push(facts.join("\n"));

  if (parts.headers) {
    const req = headersBlock("Request headers", entry.requestHeaders, depth);
    const res = headersBlock("Response headers", entry.responseHeaders, depth);
    if (req) sections.push(req);
    if (res) sections.push(res);
  }
  if (parts.request && entry.requestBody) {
    sections.push(bodyBlock("Request body", entry.requestBody, options));
  }
  if (parts.response && entry.responseBody) {
    sections.push(bodyBlock("Response body", entry.responseBody, options));
  }
  return sections.join("\n\n");
}

// The log masks the bearer token, so generated commands use a placeholder.
function forReplay(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] =
      name.toLowerCase() === "authorization" ? "Bearer <TOKEN>" : value;
  }
  return out;
}

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export function formatAsCurl(entry: NetworkEntry): string {
  const lines = [
    `curl ${entry.method === "GET" ? "" : `-X ${entry.method} `}${shellQuote(entry.url)}`,
  ];
  for (const [name, value] of Object.entries(forReplay(entry.requestHeaders))) {
    lines.push(`  -H ${shellQuote(`${name}: ${value}`)}`);
  }
  if (entry.requestBody)
    lines.push(`  --data-raw ${shellQuote(entry.requestBody)}`);
  return lines.join(" \\\n");
}

export function formatAsFetch(entry: NetworkEntry): string {
  const init: string[] = [`  method: ${JSON.stringify(entry.method)},`];
  const headers = forReplay(entry.requestHeaders);
  if (Object.keys(headers).length > 0) {
    init.push(
      `  headers: ${JSON.stringify(headers, null, 2).replaceAll("\n", "\n  ")},`,
    );
  }
  if (entry.requestBody) {
    init.push(
      isJson(entry.requestBody)
        ? `  body: JSON.stringify(${JSON.stringify(JSON.parse(entry.requestBody), null, 2).replaceAll("\n", "\n  ")}),`
        : `  body: ${JSON.stringify(entry.requestBody)},`,
    );
  }
  return `await fetch(${JSON.stringify(entry.url)}, {\n${init.join("\n")}\n});`;
}

/**
 * Sends the request again through XHR, so it is logged like any other call.
 * See `replayHeaders` for how redacted headers are handled.
 */
export function replayEntry(entry: NetworkEntry) {
  const xhr = new XMLHttpRequest();
  xhr.open(entry.method, entry.url);
  for (const [name, value] of Object.entries(entry.requestHeaders)) {
    // Redacted headers hold a masked value, so they are only sent when the
    // host app says what the real one is.
    const send = isRedacted(name)
      ? (replayHeaders?.(name, value) ?? null)
      : value;
    if (send !== null) xhr.setRequestHeader(name, send);
  }
  xhr.send(entry.requestBody);
}
