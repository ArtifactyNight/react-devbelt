// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { writeString } from "../src/core/storage";
import { VIEWPORT_STORAGE_KEY } from "../src/core/viewports";
import { switcher } from "../src/plugins/switcher";
import { resetViewportStore, setFrame } from "../src/plugins/viewport/store";

const reload = vi.fn();

HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
);

beforeEach(() => {
  reload.mockReset();
  vi.stubGlobal("location", { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

const roles = [
  { id: "admin", label: "Admin", description: "Full access" },
  { id: "viewer", label: "Viewer" },
];

function setup(overrides: Partial<Parameters<typeof switcher>[0]> = {}) {
  let value = "viewer";
  const apply = vi.fn((id: string) => {
    value = id;
  });
  const plugin = switcher({
    id: "role",
    options: roles,
    apply,
    current: () => value,
    ...overrides,
  });
  const Panel = plugin.window!.Component;
  return { plugin, apply, Panel };
}

test("picking an Option runs apply and reloads the page", async () => {
  const { apply, Panel } = setup();
  render(<Panel />);
  fireEvent.click(screen.getByRole("radio", { name: /Admin/ }));
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(apply).toHaveBeenCalledWith("admin");
});

test("reload targets the active Frame instead of the top page", async () => {
  resetViewportStore();
  writeString(VIEWPORT_STORAGE_KEY, "mobile");
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameReload = vi.fn();
  Object.defineProperty(frame, "contentWindow", {
    configurable: true,
    get: () => ({ location: { reload: frameReload } }) as unknown as Window,
  });
  setFrame(frame);
  try {
    const { Panel } = setup();
    render(<Panel />);
    fireEvent.click(screen.getByRole("radio", { name: /Admin/ }));
    await waitFor(() => expect(frameReload).toHaveBeenCalledTimes(1));
    expect(reload).not.toHaveBeenCalled();
  } finally {
    setFrame(null);
    frame.remove();
    resetViewportStore();
  }
});

test("a reload function replaces the page reload and is called with no arguments", async () => {
  const custom = vi.fn();
  const { apply, Panel } = setup({ reload: custom });
  render(<Panel />);
  fireEvent.click(screen.getByRole("radio", { name: /Admin/ }));
  await waitFor(() => expect(custom).toHaveBeenCalledTimes(1));
  expect(custom.mock.calls[0]).toEqual([]);
  expect(apply).toHaveBeenCalledWith("admin");
  expect(reload).not.toHaveBeenCalled();
});

test("reload: false applies without reloading and updates the selection", async () => {
  const { apply, Panel } = setup({ reload: false });
  render(<Panel />);
  expect(screen.getByRole("radio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("radio", { name: /Admin/ }));
  await waitFor(() =>
    expect(screen.getByRole("radio", { name: /Admin/ }).getAttribute("aria-checked")).toBe("true"),
  );
  expect(apply).toHaveBeenCalledWith("admin");
  expect(reload).not.toHaveBeenCalled();
});

test("current drives what is shown as selected; each Option shows label and description", () => {
  const { Panel } = setup({ current: () => "admin" });
  render(<Panel />);
  expect(screen.getByRole("radio", { name: /Admin/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByText("Full access")).toBeTruthy();
});

test("options may be a function, and two Axes work side by side", async () => {
  let tenant = "acme";
  let role = "admin";
  const tenants = switcher({
    id: "tenant",
    options: [
      { id: "acme", label: "Acme" },
      { id: "globex", label: "Globex" },
    ],
    apply: (id) => {
      tenant = id;
    },
    current: () => tenant,
  });
  const roleAxis = switcher({
    id: "role",
    options: () =>
      tenant === "acme"
        ? [{ id: "admin", label: "Admin" }, { id: "viewer", label: "Viewer" }]
        : [{ id: "viewer", label: "Viewer" }],
    apply: (id) => {
      role = id;
    },
    current: () => role,
  });
  expect(tenants.id).not.toBe(roleAxis.id);
  const Roles = roleAxis.window!.Component;
  const first = render(<Roles />);
  expect(first.queryAllByRole("radio")).toHaveLength(2);
  first.unmount();
  tenant = "globex";
  const second = render(<Roles />);
  expect(second.queryAllByRole("radio")).toHaveLength(1);
});

test("the current Option's label is in the Debug bundle", () => {
  const { plugin } = setup({ name: "Role" });
  expect(plugin.debugContext?.()).toEqual([{ label: "Role", value: "Viewer (viewer)" }]);
});

test("an unknown current id still shows in the Debug bundle", () => {
  const { plugin } = setup({ current: () => "ghost" });
  expect(plugin.debugContext?.()).toEqual([{ label: "role", value: "Unknown (ghost)" }]);
});

// --- Agent tools, through the Toolbar's write gate ---

type Tools = Record<string, (input?: object) => Promise<{ content: { text: string }[] }>>;
const tools = () => (window as unknown as { devbelt?: Tools }).devbelt ?? ({} as Tools);

test("the apply Agent tool is a write tool: off by default, on with agent.write", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  const { plugin, apply } = setup({ reload: false });

  const off = render(<Toolbar plugins={[plugin]} isolation="none" />);
  expect(Object.keys(tools())).toEqual(["list_role_options"]);
  off.unmount();
  delete (window as unknown as Record<string, unknown>).devbelt;

  render(<Toolbar plugins={[{ ...plugin, agent: { write: true } }]} isolation="none" />);
  expect(Object.keys(tools()).sort()).toEqual(["list_role_options", "switch_role"]);
  const result = await tools().switch_role({ id: "admin" });
  expect(apply).toHaveBeenCalledWith("admin");
  expect(result.content[0].text).toContain("admin");
  delete (window as unknown as Record<string, unknown>).devbelt;
});

test("the apply Agent tool rejects an id that is not an Option", async () => {
  const { plugin, apply } = setup();
  const tool = plugin.agentTools!.find((t) => t.name === "switch_role")!;
  expect(tool.writes).toBe(true);
  const result = await tool.run({ id: "root" }, undefined as never);
  expect(apply).not.toHaveBeenCalled();
  expect(result.content[0].text).toMatch(/not an option/i);
});

test("switcher is not part of defaultPlugins()", async () => {
  const { defaultPlugins } = await import("../src/plugins");
  expect(defaultPlugins().map((p) => p.id)).not.toContain("role");
  expect(defaultPlugins().some((p) => p.id.startsWith("switcher"))).toBe(false);
});

// --- review fixes ---

test("a rejected apply shows an error, keeps the current Option and is not unhandled", async () => {
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  const { Panel } = setup({
    reload: true,
    apply: () => Promise.reject(new Error("sign-in failed")),
  });
  render(<Panel />);
  fireEvent.click(screen.getByRole("radio", { name: /Admin/ }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/sign-in failed/));
  expect(screen.getByRole("radio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe("true");
  expect(reload).not.toHaveBeenCalled();
  await new Promise((r) => setTimeout(r, 10));
  process.off("unhandledRejection", unhandled);
  expect(unhandled).not.toHaveBeenCalled();
});

test("the apply Agent tool reports a rejected apply and an unknown id as error results", async () => {
  const { plugin } = setup({ apply: () => Promise.reject(new Error("nope")) });
  const tool = plugin.agentTools!.find((t) => t.name === "switch_role")!;
  const failed = await tool.run({ id: "admin" }, undefined as never);
  expect(failed.isError).toBe(true);
  expect(failed.content[0].text).toMatch(/nope/);
  const unknown = await tool.run({ id: "root" }, undefined as never);
  expect(unknown.isError).toBe(true);
});

test("a throwing current does not crash the panel or the Debug bundle", () => {
  const { plugin, Panel } = setup({
    current: () => {
      throw new Error("boom");
    },
  });
  expect(() => render(<Panel />)).not.toThrow();
  const entries = plugin.debugContext!();
  expect(entries[0].value).toMatch(/could not be read/i);
  const Status = plugin.Status!;
  expect(() => render(<Status />)).not.toThrow();
  const list = plugin.agentTools!.find((t) => t.name === "list_role_options")!;
  expect(() => list.run({}, undefined as never)).not.toThrow();
});

test("the Plugin id is derived from the Axis id with a fixed prefix", () => {
  expect(setup({ id: "network" }).plugin.id).toBe("switcher-network");
});

test("duplicate Option ids are rejected with a clear message", () => {
  expect(() =>
    setup({ options: [{ id: "a", label: "A" }, { id: "a", label: "Again" }] }),
  ).toThrow(/role.*"a"/);
});

test("two Switchers for the same Axis are rejected when installed together", async () => {
  const { installPlugins } = await import("../src/install-plugins");
  const a = setup().plugin;
  const b = setup().plugin;
  expect(() => installPlugins([a, b])).toThrow(/switcher-role/);
});

test("the toolbar Item shows the Axis name and the current Option", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  const { plugin } = setup({ name: "Role" });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const item = screen.getByRole("button", { name: /Role/ });
  expect(item.textContent).toMatch(/Viewer/);
});

test("picking an Option updates the Item after apply and checks that Option", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  const { plugin, apply } = setup({ name: "Role", reload: false });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  expect(screen.getByRole("menuitemradio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("menuitemradio", { name: /Admin/ }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByText("Full access")).toBeTruthy();
  await user.click(screen.getByRole("menuitemradio", { name: /Admin/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Role/ }).textContent).toMatch(/Admin/),
  );
  expect(apply).toHaveBeenCalledWith("admin");
  expect(reload).not.toHaveBeenCalled();
});

test("further picks are ignored while a switch is in progress", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  let value = "viewer";
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const apply = vi.fn(
    (id: string) =>
      pending.then(() => {
        value = id;
      }),
  );
  const plugin = switcher({
    id: "role",
    name: "Role",
    reload: false,
    options: [
      { id: "admin", label: "Admin" },
      { id: "viewer", label: "Viewer" },
      { id: "editor", label: "Editor" },
    ],
    apply,
    current: () => value,
  });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  await user.click(screen.getByRole("menuitemradio", { name: "Admin" }));
  expect(screen.getByRole("button", { name: /Role/ }).getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("status").textContent).toMatch(/Switching/);
  await user.click(screen.getByRole("menuitemradio", { name: "Editor" }));
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith("admin");
  expect(screen.getByRole("button", { name: /Role/ }).textContent).toMatch(/Viewer/);
  release();
  await waitFor(() =>
    expect(screen.getByRole("menuitemradio", { name: "Admin" }).getAttribute("aria-checked")).toBe(
      "true",
    ),
  );
  expect(screen.getByRole("button", { name: /Role/ }).textContent).toMatch(/Admin/);
});

test("a failed apply shows the error, keeps the current Option, and can be retried", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  let fail = true;
  let value = "viewer";
  const apply = vi.fn((id: string) => {
    if (fail) return Promise.reject(new Error("sign-in failed"));
    value = id;
  });
  const plugin = switcher({
    id: "role",
    name: "Role",
    reload: false,
    options: roles,
    apply,
    current: () => value,
  });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  await user.click(screen.getByRole("menuitemradio", { name: /Admin/ }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toMatch(/sign-in failed/),
  );
  expect(screen.getByRole("button", { name: /Role/ }).textContent).toMatch(/sign-in failed/);
  expect(screen.getByRole("menuitemradio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(reload).not.toHaveBeenCalled();
  fail = false;
  await user.click(screen.getByRole("menuitemradio", { name: /Admin/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Role/ }).textContent).toMatch(/Admin/),
  );
  expect(apply).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("an unknown current id shows Unknown with the id and checks nothing", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  const { plugin } = setup({ name: "Role", current: () => "ghost" });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const item = screen.getByRole("button", { name: /Role/ });
  expect(item.textContent).toContain("Unknown");
  expect(item.textContent).toContain("ghost");
  const user = userEvent.setup();
  await user.click(item);
  for (const option of screen.getAllByRole("menuitemradio")) {
    expect(option.getAttribute("aria-checked")).toBe("false");
  }
  expect(plugin.debugContext?.()).toEqual([{ label: "Role", value: "Unknown (ghost)" }]);
});

test("a null current checks nothing in the menu", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  const { plugin } = setup({ name: "Role", current: () => null });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const item = screen.getByRole("button", { name: /Role/ });
  expect(item.textContent).toContain("none");
  expect(item.textContent).not.toContain("Admin");
  expect(item.textContent).not.toContain("Viewer");
  const user = userEvent.setup();
  await user.click(item);
  for (const option of screen.getAllByRole("menuitemradio")) {
    expect(option.getAttribute("aria-checked")).toBe("false");
  }
  expect(plugin.debugContext?.()).toEqual([{ label: "Role", value: "none" }]);
});

test("async options shows a loading row, then the list", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  let resolveList: (options: typeof roles) => void = () => {};
  const plugin = switcher({
    id: "role",
    name: "Role",
    reload: false,
    options: () =>
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    apply: () => {},
    current: () => "viewer",
  });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  expect(screen.getByRole("status").textContent).toMatch(/Loading Options/);
  expect(screen.queryByRole("menuitemradio")).toBeNull();
  resolveList(roles);
  await waitFor(() =>
    expect(screen.getByRole("menuitemradio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe(
      "true",
    ),
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("the menu reads options again each time it opens", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  let tenant = "acme";
  const plugin = switcher({
    id: "role",
    name: "Role",
    reload: false,
    options: () =>
      tenant === "acme"
        ? [
            { id: "admin", label: "Admin" },
            { id: "viewer", label: "Viewer" },
          ]
        : [{ id: "viewer", label: "Viewer" }],
    apply: () => {},
    current: () => "viewer",
  });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
  await user.keyboard("{Escape}");
  tenant = "globex";
  await user.click(screen.getByRole("button", { name: /Role/ }));
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(1);
});

test("a failed options read shows the error and retry loads the list", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  let fail = true;
  const plugin = switcher({
    id: "role",
    name: "Role",
    reload: false,
    options: () => (fail ? Promise.reject(new Error("network down")) : Promise.resolve(roles)),
    apply: () => {},
    current: () => "viewer",
  });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/network down/));
  expect(screen.queryByRole("menuitemradio")).toBeNull();
  fail = false;
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByRole("menuitemradio", { name: /Viewer/ })).toBeTruthy());
  expect(screen.queryByRole("alert")).toBeNull();
});

test("an async current shows its Option and is read again after apply", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  let value: string | null = "viewer";
  const plugin = switcher({
    id: "role",
    name: "Role",
    reload: false,
    options: roles,
    apply: (id) => {
      value = id;
    },
    current: () => Promise.resolve(value),
  });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Role/ }).textContent).toContain("Viewer"),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Role/ }));
  expect(screen.getByRole("menuitemradio", { name: /Viewer/ }).getAttribute("aria-checked")).toBe(
    "true",
  );
  await user.click(screen.getByRole("menuitemradio", { name: /Admin/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Role/ }).textContent).toContain("Admin"),
  );
  expect(screen.getByRole("menuitemradio", { name: /Admin/ }).getAttribute("aria-checked")).toBe(
    "true",
  );
});

test("a Switcher is pinned when added and can be unpinned", async () => {
  const { default: Toolbar } = await import("../src/ui/toolbar");
  const { plugin } = setup({ name: "Role" });
  render(<Toolbar plugins={[plugin]} isolation="none" />);
  expect(screen.getByRole("button", { name: /Role/ })).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "More tools" }));
  const pin = screen.getByRole("menuitemcheckbox", { name: "Role" });
  expect(pin.getAttribute("aria-checked")).toBe("true");
  await user.click(pin);
  expect(screen.queryByRole("button", { name: /Role/ })).toBeNull();
});
