// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { storage } from "../src/plugins";
import { stubApi, StubToolbar } from "./helpers";

const SECRET = "eyJhbGciOi-very-secret";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("theme", "dark");
  localStorage.setItem("authToken", SECRET);
  localStorage.setItem("apiKey", "second-secret-value");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

const mountWindow = () => {
  const { Component } = storage().window!;
  return render(
    <StubToolbar>
      <Component />
    </StubToolbar>,
  );
};
const tool = (name: string) => storage().agentTools!.find((t) => t.name === name)!;
const read = async (input: Record<string, unknown> = {}) =>
  (await tool("devbelt_get_storage").run(input, stubApi())).content[0].text;

test("reveal shows one Redacted value at a time and hides it again", () => {
  mountWindow();
  expect(document.body.textContent).not.toContain(SECRET);
  fireEvent.click(screen.getByRole("button", { name: "Reveal authToken" }));
  expect(document.body.textContent).toContain(SECRET);
  fireEvent.click(screen.getByRole("button", { name: "Reveal apiKey" }));
  expect(document.body.textContent).not.toContain(SECRET);
  expect(document.body.textContent).toContain("second-secret-value");
  fireEvent.click(screen.getByRole("button", { name: "Hide apiKey" }));
  expect(document.body.textContent).not.toContain("second-secret-value");
});

test("a revealed value is hidden again after the Window closes", () => {
  const first = mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "Reveal authToken" }));
  first.unmount();
  mountWindow();
  expect(document.body.textContent).not.toContain(SECRET);
});

test("non-Redacted rows have no reveal control", () => {
  mountWindow();
  expect(screen.queryByRole("button", { name: "Reveal theme" })).toBeNull();
});

test("Clear asks for confirmation and can be cancelled", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "Clear localStorage" }));
  expect(localStorage.getItem("theme")).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Cancel clearing localStorage" }));
  expect(localStorage.getItem("theme")).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Clear localStorage" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm clearing localStorage" }));
  expect(localStorage.getItem("theme")).toBeNull();
});

test("the read Agent tool filters by store, key prefix and limit", async () => {
  sessionStorage.setItem("theme-session", "x");
  const out = await read({ store: "localStorage", prefix: "th" });
  expect(out).toContain("theme");
  expect(out).not.toContain("theme-session");
  expect(out).not.toContain("apiKey");
  for (let i = 0; i < 30; i++) localStorage.setItem(`bulk${String(i).padStart(2, "0")}`, "v");
  const limited = await read({ store: "localStorage", prefix: "bulk", limit: 3 });
  expect(limited.match(/bulk\d\d/g)).toHaveLength(3);
  expect(limited).toMatch(/3 of 30/);
});

test("the read Agent tool has a small default and a hard maximum", async () => {
  for (let i = 0; i < 300; i++) localStorage.setItem(`bulk${i}`, "v");
  expect((await read({ prefix: "bulk" })).match(/bulk\d+/g)!.length).toBeLessThanOrEqual(50);
  expect((await read({ prefix: "bulk", limit: 100000 })).match(/bulk\d+/g)!.length).toBeLessThanOrEqual(100);
});

test("a blocked store shows an unavailable state, not an empty list", async () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError");
  });
  mountWindow();
  const local = screen.getByRole("region", { name: "localStorage" });
  expect(within(local).getByText(/unavailable/i)).toBeTruthy();
  expect(within(local).queryByText("Empty.")).toBeNull();
  expect(await read()).toMatch(/localStorage[\s\S]*unavailable/i);
});

test("write tools are annotated as not read-only", () => {
  for (const name of ["devbelt_set_storage_item", "devbelt_delete_storage_item", "devbelt_clear_storage"]) {
    expect(tool(name).annotations?.readOnlyHint).toBe(false);
  }
});
