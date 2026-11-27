// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { defaultPlugins, storage } from "../src/plugins";
import ToolbarImpl from "../src/ui/toolbar";
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
  delete (window as unknown as Record<string, unknown>).devbelt;
  localStorage.clear();
  sessionStorage.clear();
});

const readTool = (plugin = storage()) =>
  plugin.agentTools!.find((t) => t.name === "devbelt_get_storage")!;

test("is opt-in: not in the default plugins, added by name", () => {
  expect(defaultPlugins().map((p) => p.id)).not.toContain("storage");
  expect(storage().id).toBe("storage");
});

test("the read tool is read-only and the write tools are marked writes", () => {
  const tools = storage().agentTools!;
  expect(tools.map((t) => t.name)).toEqual([
    "devbelt_get_storage",
    "devbelt_set_storage_item",
    "devbelt_delete_storage_item",
    "devbelt_clear_storage",
  ]);
  expect(tools[0].annotations?.readOnlyHint).toBe(true);
  for (const tool of tools.slice(1)) expect(tool.writes).toBe(true);
});

type Tools = Record<string, (input?: object) => Promise<unknown> | unknown>;
const exposed = () =>
  Object.keys((window as unknown as { devbelt?: Tools }).devbelt ?? {}).sort();

test("write Agent tools are off by default and on with agent: { write: true }", () => {
  const off = render(<ToolbarImpl plugins={[storage()]} isolation="none" />);
  expect(exposed()).toEqual(["devbelt_get_storage"]);
  off.unmount();
  delete (window as unknown as Record<string, unknown>).devbelt;
  render(<ToolbarImpl plugins={[{ ...storage(), agent: { write: true } }]} isolation="none" />);
  expect(exposed()).toEqual([
    "devbelt_clear_storage",
    "devbelt_delete_storage_item",
    "devbelt_get_storage",
    "devbelt_set_storage_item",
  ]);
});

const tool = (name: string) => storage().agentTools!.find((t) => t.name === name)!;

test("set tool edits a value, including a redacted one, without echoing values", async () => {
  const a = await tool("devbelt_set_storage_item").run(
    { store: "localStorage", key: "theme", value: "light" },
    stubApi(),
  );
  expect(localStorage.getItem("theme")).toBe("light");
  const b = await tool("devbelt_set_storage_item").run(
    { store: "localStorage", key: "authToken", value: "fresh-secret" },
    stubApi(),
  );
  expect(localStorage.getItem("authToken")).toBe("fresh-secret");
  expect(JSON.stringify([a, b])).not.toMatch(/fresh-secret|SECRET/);
});

test("delete tool removes an entry; clear tool spares devbelt:* keys", async () => {
  await tool("devbelt_delete_storage_item").run({ store: "localStorage", key: "authToken" }, stubApi());
  expect(localStorage.getItem("authToken")).toBeNull();
  await tool("devbelt_clear_storage").run({ store: "localStorage" }, stubApi());
  expect(localStorage.getItem("theme")).toBeNull();
  expect(localStorage.getItem("devbelt:layout")).toBe("{}");
});

test("write tools reject a bad store and devbelt:* keys", async () => {
  await expect(
    tool("devbelt_set_storage_item").run({ store: "nope", key: "a", value: "b" }, stubApi()),
  ).rejects.toThrow();
  await expect(
    tool("devbelt_delete_storage_item").run({ store: "localStorage", key: "devbelt:layout" }, stubApi()),
  ).rejects.toThrow();
});

const mountWindow = () => {
  const { Component } = storage().window!;
  render(
    <StubToolbar>
      <Component />
    </StubToolbar>,
  );
};

test("Window: edit a value", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "Edit theme" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Value for theme" }), {
    target: { value: "light" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save theme" }));
  expect(localStorage.getItem("theme")).toBe("light");
  expect(screen.getByText("light")).toBeTruthy();
});

test("Window: a redacted value is replaced without being revealed", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "Edit authToken" }));
  const input = screen.getByRole("textbox", { name: "Value for authToken" }) as HTMLInputElement;
  expect(input.value).toBe("");
  expect(document.body.innerHTML).not.toContain(SECRET);
  fireEvent.change(input, { target: { value: "replacement" } });
  fireEvent.click(screen.getByRole("button", { name: "Save authToken" }));
  expect(localStorage.getItem("authToken")).toBe("replacement");
  expect(document.body.innerHTML).not.toContain("replacement");
});

test("Window: delete an entry, including a redacted one", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "Delete authToken" }));
  expect(localStorage.getItem("authToken")).toBeNull();
  expect(screen.queryByText("authToken")).toBeNull();
});

test("Window: clear a store leaves devbelt:* keys", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "Clear localStorage" }));
  expect(localStorage.getItem("theme")).toBeNull();
  expect(localStorage.getItem("devbelt:layout")).toBe("{}");
  expect(sessionStorage.getItem("step")).toBe("2");
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
