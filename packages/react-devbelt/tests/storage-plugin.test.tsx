// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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
const clearCookies = () => {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).devbelt;
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
  clearCookies();
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
  fireEvent.click(screen.getByRole("button", { name: "Confirm clearing localStorage" }));
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

test("the Window has one tab per store and shows only the active store", () => {
  mountWindow();
  expect(screen.getByRole("tab", { name: "localStorage" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "sessionStorage" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Cookies" })).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "localStorage" })).getByText("theme")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "sessionStorage" })).toBeNull();
  expect(screen.queryByText("step")).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: "sessionStorage" }));
  expect(within(screen.getByRole("region", { name: "sessionStorage" })).getByText("step")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "localStorage" })).toBeNull();
  expect(screen.queryByText("theme")).toBeNull();
});

test("the filter field narrows the active tab", () => {
  localStorage.setItem("other", "1");
  mountWindow();
  fireEvent.change(screen.getByRole("textbox", { name: "Filter entries" }), {
    target: { value: "theme" },
  });
  const local = screen.getByRole("region", { name: "localStorage" });
  expect(within(local).getByText("theme")).toBeTruthy();
  expect(within(local).queryByText("authToken")).toBeNull();
  expect(within(local).queryByText("other")).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: "sessionStorage" }));
  const session = screen.getByRole("region", { name: "sessionStorage" });
  expect(within(session).queryByText("step")).toBeNull();
  expect(within(session).getByText("No matches.")).toBeTruthy();
});

test("opening an entry shows its value formatted as JSON", () => {
  localStorage.setItem("cfg", JSON.stringify({ color: "blue", n: 2 }));
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "cfg" }));
  const detail = screen.getByRole("region", { name: "Details for cfg" });
  expect(detail.querySelector("pre")?.textContent).toBe('{\n  "color": "blue",\n  "n": 2\n}');
});

test("a long value is shortened in the list and in the detail until expanded", () => {
  const value = "a".repeat(300);
  localStorage.setItem("note", value);
  mountWindow();
  const local = screen.getByRole("region", { name: "localStorage" });
  expect(within(local).getByText(`${"a".repeat(80)}…`)).toBeTruthy();
  expect(within(local).getByText("300")).toBeTruthy();
  expect(within(local).queryByText(value)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "note" }));
  const detail = screen.getByRole("region", { name: "Details for note" });
  expect(detail.querySelector("pre")?.textContent).toBe(`${"a".repeat(240)}…`);

  fireEvent.click(screen.getByRole("button", { name: "Expand value" }));
  expect(screen.getByRole("region", { name: "Details for note" }).querySelector("pre")?.textContent).toBe(value);
});

test("a Redacted value stays hidden in the detail until it is revealed", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("button", { name: "authToken" }));
  const detail = screen.getByRole("region", { name: "Details for authToken" });
  expect(detail.textContent).toContain(`[redacted: ${SECRET.length} chars]`);
  expect(detail.textContent).not.toContain(SECRET);
  fireEvent.click(screen.getByRole("button", { name: "Reveal authToken" }));
  expect(screen.getByRole("region", { name: "Details for authToken" }).textContent).toContain(SECRET);
});

test("an entry can be added to the active store", () => {
  mountWindow();
  fireEvent.click(screen.getByRole("tab", { name: "sessionStorage" }));
  fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New key" }), { target: { value: "flag" } });
  fireEvent.change(screen.getByRole("textbox", { name: "New value" }), { target: { value: "on" } });
  fireEvent.click(screen.getByRole("button", { name: "Save new entry" }));
  expect(sessionStorage.getItem("flag")).toBe("on");
  expect(localStorage.getItem("flag")).toBeNull();
  expect(screen.getByRole("button", { name: "flag" })).toBeTruthy();
  expect(screen.getByText("on")).toBeTruthy();
});

test("the stores option leaves out stores it does not list", () => {
  const { Component } = storage({ stores: ["cookies"] }).window!;
  render(
    <StubToolbar>
      <Component />
    </StubToolbar>,
  );
  expect(screen.getByRole("tab", { name: "Cookies" })).toBeTruthy();
  expect(screen.queryByRole("tab", { name: "localStorage" })).toBeNull();
  expect(screen.queryByRole("tab", { name: "sessionStorage" })).toBeNull();
  expect(screen.queryByText("theme")).toBeNull();
  const [section] = storage({ stores: ["cookies"] }).debugSections!();
  expect(section).not.toContain("theme");
  expect(section).not.toContain("step");
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
  fireEvent.click(screen.getByRole("tab", { name: "sessionStorage" }));
  const session = screen.getByRole("region", { name: "sessionStorage" });
  expect(within(session).getByText("step")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Cookies" }));
  expect(screen.getByRole("region", { name: "Cookies" })).toBeTruthy();
  expect(screen.getByText(/HttpOnly cookies cannot be seen/)).toBeTruthy();
  expect(document.body.textContent).not.toContain(SECRET);
  expect(document.body.textContent).not.toContain("devbelt:layout");
});

test("a page write shows up in the Window without a refresh", () => {
  render(<ToolbarImpl plugins={[storage()]} isolation="none" />);
  fireEvent.click(screen.getByRole("button", { name: "Storage" }));
  expect(screen.getByText("dark")).toBeTruthy();

  act(() => {
    localStorage.setItem("theme", "light");
  });

  expect(screen.getByText("light")).toBeTruthy();
  expect(screen.queryByText("dark")).toBeNull();
});

test("a write in the Frame shows up in the Window", async () => {
  render(<ToolbarImpl plugins={[storage()]} isolation="none" />);
  fireEvent.click(screen.getByRole("button", { name: "Storage" }));
  const frame = document.createElement("iframe");
  document.body.append(frame);

  try {
    frame.contentWindow!.localStorage.setItem("framed", "yes");
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(screen.getByText("framed")).toBeTruthy();
    expect(screen.getByText("yes")).toBeTruthy();
  } finally {
    frame.remove();
  }
});

test("a cookie the page writes shows up while the Window is open", () => {
  vi.useFakeTimers();
  render(<ToolbarImpl plugins={[storage()]} isolation="none" />);
  fireEvent.click(screen.getByRole("button", { name: "Storage" }));
  fireEvent.click(screen.getByRole("tab", { name: "Cookies" }));
  expect(screen.getByText("Empty.")).toBeTruthy();

  document.cookie = "locale=en; path=/";
  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(screen.getByText("locale")).toBeTruthy();
  expect(screen.getByText("en")).toBeTruthy();
});

test("the Window reopens on the last-used tab", () => {
  render(<ToolbarImpl plugins={[storage()]} isolation="none" />);
  fireEvent.click(screen.getByRole("button", { name: "Storage" }));
  fireEvent.click(screen.getByRole("tab", { name: "sessionStorage" }));
  fireEvent.click(screen.getByRole("button", { name: "Close Storage" }));
  fireEvent.click(screen.getByRole("button", { name: "Storage" }));

  expect(screen.getByRole("region", { name: "sessionStorage" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "localStorage" })).toBeNull();
  expect(screen.queryByText("theme")).toBeNull();
});

test("the cookies tab explains that a cookie on another path is not affected", () => {
  mountWindow();
  expect(screen.queryByText(/another path/i)).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Cookies" }));
  const note = screen.getByText(/another path/i);
  expect(note.textContent).toMatch(/editing or clearing/i);
  expect(note.textContent).toMatch(/not affected/i);
});
