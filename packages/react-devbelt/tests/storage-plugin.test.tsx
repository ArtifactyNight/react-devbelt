// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { defaultPlugins, storage } from "../src/plugins";
import { stubApi, StubToolbar } from "./helpers";

const SECRET = "eyJhbGciOi-very-secret";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("theme", "dark");
  localStorage.setItem("authToken", SECRET);
  localStorage.setItem("devbelt:layout", "{}");
  sessionStorage.setItem("step", "2");
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

const readTool = (plugin = storage()) =>
  plugin.agentTools!.find((t) => t.name === "devbelt_get_storage")!;

test("is opt-in: not in the default plugins, added by name", () => {
  expect(defaultPlugins().map((p) => p.id)).not.toContain("storage");
  expect(storage().id).toBe("storage");
});

test("offers only read Agent tools", () => {
  const tools = storage().agentTools!;
  expect(tools.map((t) => t.name)).toEqual(["devbelt_get_storage"]);
  for (const tool of tools) expect(tool.annotations?.readOnlyHint).toBe(true);
});

test("the read Agent tool returns the redacted view without devbelt:* keys", async () => {
  const result = await readTool().run({}, stubApi());
  const out = result.content[0].text;
  expect(out).toContain("theme");
  expect(out).toContain("dark");
  expect(out).toContain("step");
  expect(out).toContain(`[redacted: ${SECRET.length} chars]`);
  expect(out).not.toContain(SECRET);
  expect(out).not.toContain("devbelt:layout");
  expect(out).toMatch(/HttpOnly/);
});

test("a custom redaction pattern applies to the Agent tool", async () => {
  const out = (await readTool(storage({ redact: /theme/i })).run({}, stubApi())).content[0].text;
  expect(out).not.toContain("dark");
});

test("the Debug bundle gets names and sizes only by default", () => {
  const [section] = storage().debugSections!();
  expect(section).toContain("authToken");
  expect(section).toContain("theme");
  expect(section).not.toContain("dark");
  expect(section).not.toContain(SECRET);
});

test("includeValuesInBundle adds values but never redacted ones", () => {
  const [section] = storage({ includeValuesInBundle: true }).debugSections!();
  expect(section).toContain("dark");
  expect(section).not.toContain(SECRET);
});

test("the Window groups entries by store, hides redacted values and states the HttpOnly limit", () => {
  const { Component } = storage().window!;
  render(
    <StubToolbar>
      <Component />
    </StubToolbar>,
  );
  const local = screen.getByRole("region", { name: "localStorage" });
  expect(within(local).getByText("theme")).toBeTruthy();
  expect(within(local).getByText("dark")).toBeTruthy();
  expect(within(local).getByText(`[redacted: ${SECRET.length} chars]`)).toBeTruthy();
  const session = screen.getByRole("region", { name: "sessionStorage" });
  expect(within(session).getByText("step")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Cookies" })).toBeTruthy();
  expect(screen.getByText(/HttpOnly cookies cannot be seen/)).toBeTruthy();
  expect(document.body.textContent).not.toContain(SECRET);
  expect(document.body.textContent).not.toContain("devbelt:layout");
});
