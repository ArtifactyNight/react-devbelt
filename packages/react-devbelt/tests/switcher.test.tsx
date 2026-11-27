// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { switcher } from "../src/plugins/switcher";

const reload = vi.fn();

beforeEach(() => {
  reload.mockReset();
  vi.stubGlobal("location", { ...window.location, reload });
});

afterEach(() => {
  cleanup();
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
  expect(plugin.debugContext?.()).toEqual([{ label: "role", value: "ghost" }]);
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
