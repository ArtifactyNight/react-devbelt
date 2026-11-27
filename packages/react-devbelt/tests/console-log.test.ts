// @vitest-environment jsdom

import { beforeAll, beforeEach, expect, test, vi } from "vitest";

import {
  clearConsoleLog,
  formatConsoleArgs,
  formatConsoleForAgent,
  getConsoleEntries,
  installConsoleLog,
} from "../src/core/console-log";

const passthrough = vi.fn();

beforeAll(() => {
  console.error = passthrough;
  console.warn = passthrough;
  installConsoleLog();
});

beforeEach(() => {
  clearConsoleLog();
  passthrough.mockClear();
});

test("records console.error and console.warn and still prints them", () => {
  console.error("Boom");
  console.warn("Careful");

  const [warn, error] = getConsoleEntries();
  expect(error).toMatchObject({ level: "error", message: "Boom", count: 1 });
  expect(warn).toMatchObject({ level: "warn", message: "Careful" });
  expect(passthrough).toHaveBeenCalledTimes(2);
  expect(error.pageUrl).toMatch(/^http/);
  expect(error.viewport).toMatch(/^Full \d+×\d+$/);
});

test("fills printf-style placeholders like the browser console", () => {
  expect(
    formatConsoleArgs(["Got %s of %d (%o)", "a", 3.7, { x: 1 }, "extra"]),
  ).toBe('Got a of 3 ({"x":1}) extra');
  expect(formatConsoleArgs(["100%% sure", "left"])).toBe("100% sure left");
  expect(formatConsoleArgs(["no placeholders", 1, { a: 1 }])).toBe(
    'no placeholders 1 {"a":1}',
  );
});

test("an Error argument brings its stack along", () => {
  const error = new Error("exploded");
  console.error(error);
  const [entry] = getConsoleEntries();
  expect(entry.message).toContain("exploded");
  expect(entry.stack).toContain("exploded");
});

test("identical messages in a row collapse into a count", () => {
  console.error("same");
  console.error("same");
  console.error("same");
  console.error("different");
  console.error("same");
  expect(getConsoleEntries().map((e) => [e.message, e.count])).toEqual([
    ["same", 1],
    ["different", 1],
    ["same", 3],
  ]);
});

test("uncaught errors and unhandled rejections are recorded", () => {
  window.dispatchEvent(
    new ErrorEvent("error", {
      message: "kaput",
      filename: "app.js",
      lineno: 3,
      colno: 9,
      error: new Error("kaput"),
    }),
  );
  const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
  Object.defineProperty(rejection, "reason", { value: new Error("nope") });
  window.dispatchEvent(rejection);

  const [rejected, uncaught] = getConsoleEntries();
  expect(uncaught.message).toBe("Uncaught kaput (app.js:3:9)");
  expect(rejected.message).toContain("Unhandled promise rejection:");
  expect(rejected.message).toContain("nope");
});

test("formats entries as markdown with a safe fence", () => {
  console.error("has ``` fence");
  const text = formatConsoleForAgent(getConsoleEntries());
  expect(text).toMatch(/^## console\.error\n/);
  expect(text).toContain("- **Page:** http");
  expect(text).toContain("- **Viewport:** Full");
  expect(text).toContain("### Message\n````text\nhas ``` fence\n````");
});

test("a repeated message shows its count in the heading", () => {
  console.warn("again");
  console.warn("again");
  expect(formatConsoleForAgent(getConsoleEntries())).toMatch(
    /^## console\.warn \(×2\)/,
  );
});
