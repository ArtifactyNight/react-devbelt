// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DevBeltPlugin } from "react-devbelt";
import { exposedAgentTools } from "react-devbelt/core";

import { tanstackQuery } from "../src";

let client: QueryClient;
let plugin: DevBeltPlugin;
let teardown: (() => void) | void;

const setup = (agent?: { write?: boolean }) => {
  teardown?.();
  client?.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  plugin = tanstackQuery(client, { agent });
  teardown = plugin.install?.();
};

afterEach(() => {
  cleanup();
  teardown?.();
  client.clear();
});

const counted = (key: unknown[]) => {
  let n = 0;
  const run = () => client.fetchQuery({ queryKey: key, queryFn: () => ++n, staleTime: 60_000 });
  return { run, count: () => n };
};

const renderWindow = () => {
  const Window = plugin.window!.Component;
  return render(<Window />);
};

const call = async (name: string, input: Record<string, unknown> = {}) => {
  const tool = plugin.agentTools!.find((t) => t.name === name)!;
  const result = await tool.run(input, undefined as never);
  return result.content.map((c) => c.text).join("\n");
};

describe("Window actions", () => {
  it("refetch runs the query again and the row updates", async () => {
    setup();
    const todos = counted(["todos"]);
    await todos.run();
    renderWindow();
    expect(screen.getByRole("row", { name: /\["todos"\]/ }).textContent).toMatch(/1 fetch(?!es)/);

    fireEvent.click(screen.getByRole("button", { name: /Refetch \["todos"\]/ }));

    await waitFor(() => expect(todos.count()).toBe(2));
    await waitFor(() =>
      expect(screen.getByRole("row", { name: /\["todos"\]/ }).textContent).toMatch(/2 fetches/),
    );
  });

  it("invalidate marks the query stale", async () => {
    setup();
    await counted(["todos"]).run();
    expect(client.getQueryState(["todos"])?.isInvalidated).toBe(false);
    renderWindow();

    fireEvent.click(screen.getByRole("button", { name: /Invalidate \["todos"\]/ }));

    await waitFor(() => expect(client.getQueryState(["todos"])?.isInvalidated).toBe(true));
  });

  it("reset puts the query back to its initial state", async () => {
    setup();
    await counted(["todos"]).run();
    renderWindow();

    fireEvent.click(screen.getByRole("button", { name: /Reset \["todos"\]/ }));

    await waitFor(() => expect(client.getQueryState(["todos"])?.status).toBe("pending"));
    expect(client.getQueryData(["todos"])).toBeUndefined();
  });

  it("acts only on the row's own query", async () => {
    setup();
    const a = counted(["a"]);
    const b = counted(["b"]);
    await a.run();
    await b.run();
    renderWindow();

    fireEvent.click(screen.getByRole("button", { name: /Refetch \["a"\]/ }));

    await waitFor(() => expect(a.count()).toBe(2));
    expect(b.count()).toBe(1);
  });

  it("offers no actions on the Mutations tab", async () => {
    setup();
    await client.getMutationCache().build(client, { mutationKey: ["save"], mutationFn: async () => 1 }).execute(undefined);
    renderWindow();
    fireEvent.click(screen.getByRole("tab", { name: "Mutations" }));
    expect(screen.queryByRole("button", { name: /Refetch|Invalidate|Reset/ })).toBeNull();
  });
});

describe("write Agent tools", () => {
  const NAMES = [
    "devbelt_refetch_tanstack_query",
    "devbelt_invalidate_tanstack_query",
    "devbelt_reset_tanstack_query",
  ];

  it("do not exist by default", () => {
    setup();
    const exposed = () => exposedAgentTools([plugin]).map((t) => t.name);
    setup();
    for (const n of NAMES) expect(exposed()).not.toContain(n);
    setup({ write: false });
    for (const n of NAMES) expect(exposed()).not.toContain(n);
  });

  it("are exposed when the app spreads the plugin with agent.write", () => {
    setup();
    const spread = { ...plugin, agent: { write: true } };
    const names = exposedAgentTools([spread]).map((t) => t.name);
    for (const n of NAMES) expect(names).toContain(n);
  });

  it("exist with agent.write, marked as writing", () => {
    setup({ write: true });
    for (const n of NAMES) {
      const tool = plugin.agentTools!.find((t) => t.name === n)!;
      expect(tool.writes).toBe(true);
      expect(tool.annotations?.readOnlyHint).toBeFalsy();
    }
  });

  it("refetch by the key text shown in the Window", async () => {
    setup({ write: true });
    const todos = counted(["todos", { page: 1 }]);
    await todos.run();
    const out = await call(NAMES[0], { key: '["todos",{"page":1}]' });
    expect(out).toMatch(/refetch/i);
    expect(todos.count()).toBe(2);
  });

  it("invalidate and reset by key", async () => {
    setup({ write: true });
    await counted(["todos"]).run();
    await call(NAMES[1], { key: '["todos"]' });
    expect(client.getQueryState(["todos"])?.isInvalidated).toBe(true);
    await call(NAMES[2], { key: '["todos"]' });
    expect(client.getQueryState(["todos"])?.status).toBe("pending");
  });

  it("report an unknown key without changing anything", async () => {
    setup({ write: true });
    const todos = counted(["todos"]);
    await todos.run();
    const out = await call(NAMES[0], { key: '["nope"]' });
    expect(out).toMatch(/no query/i);
    expect(todos.count()).toBe(1);
    const tool = plugin.agentTools!.find((t) => t.name === NAMES[0])!;
    expect((await tool.run({ key: '["nope"]' }, undefined as never)).isError).toBe(true);
  });
});
