// @vitest-environment jsdom

import { expect, test } from "vitest";

import type { ConsoleEntry } from "../src/core/console-log";
import {
  formatDebugBundle,
  formatRecentProblems,
} from "../src/core/debug-bundle";
import type { NetworkEntry } from "../src/core/network-log";

const NOW = Date.parse("2026-11-27T10:00:00.000Z");

function net(over: Partial<NetworkEntry>): NetworkEntry {
  return {
    id: 1,
    method: "GET",
    url: "https://api.test/api/v1/tickets?page=2",
    status: 200,
    startedAt: NOW - 1_000,
    duration: 40,
    pageUrl: "http://localhost:3000/tickets",
    viewport: "Mobile 390×844",
    requestHeaders: {},
    requestBody: null,
    responseHeaders: {},
    responseBody: '{"ok":true}',
    ...over,
  };
}

function log(over: Partial<ConsoleEntry>): ConsoleEntry {
  return {
    id: 1,
    level: "error",
    message: "Hydration failed\nsecond line",
    stack: "at Page (page.tsx:10)",
    at: NOW - 2_000,
    pageUrl: "http://localhost:3000/tickets",
    viewport: "Mobile 390×844",
    count: 1,
    ...over,
  };
}

const context = [
  { label: "Page", value: "http://localhost:3000/tickets" },
  { label: "Viewport", value: "Mobile 390×844" },
  { label: "Language", value: "th" },
  { label: "Theme", value: "dark" },
];

test("the bundle starts with where the page is and what it was showing", () => {
  const text = formatDebugBundle(context, [], [], NOW);
  expect(text).toMatch(
    /^# Debug context\n\n- \*\*Page:\*\* http:\/\/localhost:3000\/tickets/,
  );
  expect(text).toContain("- **Viewport:** Mobile 390×844");
  expect(text).toContain("- **Language:** th");
  expect(text).toContain("- **Theme:** dark");
  expect(text).toContain("- **Captured:** 2026-11-27T10:00:00.000Z");
  expect(text).toContain(
    "## Console (0 errors, 0 warnings)\n\nNothing logged.",
  );
  expect(text).toContain("## Failed requests (0)\n\nNone.");
});

test("the bundle lists console entries and failed requests under its own headings", () => {
  const text = formatDebugBundle(
    context,
    [
      net({
        id: 3,
        method: "POST",
        url: "https://api.test/api/v1/tickets",
        status: 500,
        responseBody: '{"error":"boom"}',
        requestBody: '{"title":"x"}',
      }),
      net({ id: 2 }),
    ],
    [log({}), log({ id: 2, level: "warn", message: "Deprecated" })],
    NOW,
  );
  expect(text).toContain("## Console (1 error, 1 warning)");
  expect(text).toContain("### console.error");
  expect(text).toContain("#### Message");
  expect(text).toContain("## Failed requests (1)");
  expect(text).toContain("### POST /api/v1/tickets → 500");
  expect(text).toContain(
    '#### Response body\n```json\n{\n  "error": "boom"\n}\n```',
  );
  expect(text).toContain("## Recent requests (latest 2 of 2)");
  expect(text).toContain("| POST | /api/v1/tickets | 500 | 40 ms |");
  expect(text).toContain("| GET | /api/v1/tickets?page=2 | 200 | 40 ms |");
});

test("bodies in the bundle are clipped harder than a normal copy", () => {
  const text = formatDebugBundle(
    context,
    [net({ status: 500, responseBody: "x".repeat(5_000) })],
    [],
    NOW,
  );
  expect(text).toContain("[truncated, 3000 more characters]");
});

test("recent problems is empty when nothing went wrong", () => {
  expect(formatRecentProblems([net({})], [log({ level: "warn" })], NOW)).toBe(
    "",
  );
});

test("recent problems lists errors and failed requests from the last five minutes", () => {
  const text = formatRecentProblems(
    [
      net({
        id: 3,
        method: "POST",
        url: "https://api.test/api/v1/x",
        status: 422,
        responseBody: '{\n "error": "bad"\n}',
      }),
      net({ id: 2, status: 500, startedAt: NOW - 10 * 60_000 }),
    ],
    [log({}), log({ id: 2, message: "old", at: NOW - 10 * 60_000 })],
    NOW,
  );
  expect(text).toContain("## Recent problems (last 5 minutes)");
  expect(text).toContain("- Hydration failed — 2026-11-27T09:59:58.000Z");
  expect(text).not.toContain("second line");
  expect(text).toContain('- POST /api/v1/x → 422 — { "error": "bad" }');
  expect(text).not.toContain("old");
  expect(text.match(/→ 500/g)).toBeNull();
});
