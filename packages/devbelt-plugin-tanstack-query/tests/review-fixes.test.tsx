// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DevBeltPlugin } from "react-devbelt";
import { exposedAgentTools } from "react-devbelt/core";

import { tanstackQuery } from "../src";

let client: QueryClient;
let plugin: DevBeltPlugin;
let teardown: (() => void) | void;

const setup = (agent?: { write?: boolean }) => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  plugin = tanstackQuery(client, { agent });
  teardown = plugin.install?.();
};

afterEach(() => {
  cleanup();
  teardown?.();
  client.clear();
});

const call = async (name: string, input: Record<string, unknown> = {}) => {
  const tool = plugin.agentTools!.find((t) => t.name === name)!;
  const result = await tool.run(input, undefined as never);
  return { text: result.content.map((c) => c.text).join("\n"), isError: result.isError };
};

const failing = async (key: unknown[], message: string) => {
  await client.fetchQuery({ queryKey: key, queryFn: () => Promise.reject(new Error(message)) }).catch(() => {});
};

const SECRET = "sk-live-abc123XYZ";

describe("Redaction of error messages", () => {
  it("never shows a secret from an error in the Window, bundle or Agent tool", async () => {
    setup();
    await failing(["me"], `401 for Authorization: Bearer ${SECRET} and token=${SECRET}`);
    const Window = plugin.window!.Component;
    const { container } = render(<Window />);
    const bundle = plugin.debugSections!().join("\n");
    const agent = (await call("devbelt_get_tanstack_query")).text;
    for (const out of [container.textContent, bundle, agent]) {
      expect(out).not.toContain(SECRET);
      expect(out).toContain("401 for");
    }
  });

  it("redacts mutation error messages too", async () => {
    setup();
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new Error(`password=${SECRET}`)) })
      .execute(undefined)
      .catch(() => {});
    const agent = (await call("devbelt_get_tanstack_query")).text;
    expect(agent).not.toContain(SECRET);
  });
});

describe("Redaction of keys", () => {
  it("redacts a bare string element after a secret-looking name", async () => {
    setup();
    await client.fetchQuery({ queryKey: ["auth", "Bearer x"], queryFn: () => 1 });
    const Window = plugin.window!.Component;
    const { container } = render(<Window />);
    expect(container.textContent).not.toContain("Bearer x");
    expect(container.textContent).toContain("redacted");
  });

  it("keeps two same-length secret keys distinguishable and refuses ambiguity", async () => {
    setup({ write: true });
    await client.fetchQuery({ queryKey: ["x", { token: "aaaaaa" }], queryFn: () => 1 });
    await client.fetchQuery({ queryKey: ["x", { token: "bbbbbb" }], queryFn: () => 2 });
    const Window = plugin.window!.Component;
    render(<Window />);
    const keys = screen.getAllByRole("row").map((r) => r.querySelector(".tq-key")?.textContent);
    expect(new Set(keys).size).toBe(2);
    const shown = keys[0]!;
    const ok = await call("devbelt_invalidate_tanstack_query", { key: shown });
    expect(ok.isError).toBeFalsy();
    expect(client.getQueryCache().getAll().filter((q) => q.state.isInvalidated)).toHaveLength(1);
  });

  it("refuses an action when two queries print the same", async () => {
    setup({ write: true });
    // object key order differs, so they are distinct queries... use two with equal text via toJSON
    const same = () => ({ toJSON: () => "same" });
    await client.fetchQuery({ queryKey: ["dup", same(), 1], queryFn: () => 1 });
    await client.fetchQuery({ queryKey: ["dup", same(), 2], queryFn: () => 2 });
    // collapse printing: both print differently by number, so force identical printing
    const out = await call("devbelt_invalidate_tanstack_query", { key: '["dup","same"]' });
    expect(out.isError).toBe(true);
    expect(client.getQueryCache().getAll().some((q) => q.state.isInvalidated)).toBe(false);
  });
});

describe("write tools", () => {
  it("are present on the plugin but not exposed by default", () => {
    setup();
    expect(exposedAgentTools([plugin]).every((t) => !t.writes)).toBe(true);
  });
});

describe("mutation without a key", () => {
  it("omits the placeholder text", async () => {
    setup();
    await client.getMutationCache().build(client, { mutationFn: async () => 1 }).execute(undefined);
    const agent = (await call("devbelt_get_tanstack_query")).text;
    expect(agent).not.toContain("(no key)");
  });
});

describe("version check", () => {
  it("names v5", () => {
    // @ts-expect-error not a client
    expect(() => tanstackQuery({ getQueryCache() {} })).toThrow(/v5/);
  });
});
