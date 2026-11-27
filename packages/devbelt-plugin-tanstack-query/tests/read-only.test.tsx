// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DevBeltPlugin } from "react-devbelt";

import { tanstackQuery } from "../src";

let client: QueryClient;
let plugin: DevBeltPlugin;
let teardown: (() => void) | void;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  plugin = tanstackQuery(client);
  teardown = plugin.install?.();
});

afterEach(() => {
  cleanup();
  teardown?.();
  client.clear();
});

const fail = (key: unknown[], message: string) =>
  client.fetchQuery({ queryKey: key, queryFn: () => Promise.reject(new Error(message)) }).catch(() => {});

const pending = (key: unknown[]) => {
  void client.fetchQuery({ queryKey: key, queryFn: () => new Promise(() => {}) }).catch(() => {});
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

describe("Window", () => {
  it("lists queries with key, status, fetch count and error", async () => {
    await client.fetchQuery({ queryKey: ["todos"], queryFn: () => ["a"] });
    await fail(["user", 7], "boom 500");
    renderWindow();

    const todos = screen.getByRole("row", { name: /\["todos"\]/ });
    expect(todos.textContent).toMatch(/fresh|stale|inactive/);
    expect(todos.textContent).toMatch(/1 fetch/);

    const user = screen.getByRole("row", { name: /\["user",7\]/ });
    expect(user.textContent).toMatch(/error/);
    expect(user.textContent).toMatch(/boom 500/);
  });

  it("updates live as the cache changes", async () => {
    renderWindow();
    expect(screen.queryByRole("row", { name: /\["late"\]/ })).toBeNull();

    await client.fetchQuery({ queryKey: ["late"], queryFn: () => 1 });
    expect(await screen.findByRole("row", { name: /\["late"\]/ })).toBeTruthy();

    await fail(["late"], "now broken");
    await waitFor(() =>
      expect(screen.getByRole("row", { name: /\["late"\]/ }).textContent).toMatch(/now broken/),
    );
  });

  it("shows a fetching query as fetching", async () => {
    pending(["slow"]);
    renderWindow();
    expect(screen.getByRole("row", { name: /\["slow"\]/ }).textContent).toMatch(/fetching/);
  });

  it("lists mutations with status and error on the Mutations tab", async () => {
    await client
      .getMutationCache()
      .build(client, { mutationKey: ["save"], mutationFn: () => Promise.reject(new Error("save failed")) })
      .execute(undefined)
      .catch(() => {});
    renderWindow();

    screen.getByRole("tab", { name: /mutations/i }).click();
    const row = await screen.findByRole("row", { name: /\["save"\]/ });
    expect(row.textContent).toMatch(/error/);
    expect(row.textContent).toMatch(/save failed/);
  });

  it("hides secret-looking values inside keys", async () => {
    await client.fetchQuery({ queryKey: ["me", { token: "s3cr3t-value" }], queryFn: () => 1 });
    renderWindow();
    expect(document.body.textContent).not.toContain("s3cr3t-value");
    expect(document.body.textContent).toContain("[redacted: 12 chars]");
  });
});

describe("Badge and Hint", () => {
  it("counts failing queries and says how many are fetching", async () => {
    await fail(["a"], "x");
    await fail(["b"], "y");
    pending(["c"]);
    const Badge = plugin.Badge!;
    const Hint = plugin.Hint!;
    render(
      <>
        <span data-testid="badge">
          <Badge />
        </span>
        <span data-testid="hint">
          <Hint />
        </span>
      </>,
    );
    expect(screen.getByTestId("badge").textContent).toBe("2");
    expect(screen.getByTestId("hint").textContent).toMatch(/1 fetching/);

    await fail(["d"], "z");
    await waitFor(() => expect(screen.getByTestId("badge").textContent).toBe("3"));
  });

  it("shows no badge when nothing fails", async () => {
    await client.fetchQuery({ queryKey: ["ok"], queryFn: () => 1 });
    const Badge = plugin.Badge!;
    render(
      <span data-testid="badge">
        <Badge />
      </span>,
    );
    expect(screen.getByTestId("badge").textContent).toBe("");
  });
});

describe("Debug bundle", () => {
  it("lists failed and pending queries, without data or secrets", async () => {
    await client.fetchQuery({ queryKey: ["fine"], queryFn: () => ({ email: "ok@x.test" }) });
    await fail(["orders", { apiKey: "abc123" }], "HTTP 500");
    pending(["inflight"]);

    const [section] = plugin.debugSections!();
    expect(section).toContain("## TanStack Query");
    expect(section).toContain("HTTP 500");
    expect(section).toContain('["inflight"]');
    expect(section).not.toContain('["fine"]');
    expect(section).not.toContain("ok@x.test");
    expect(section).not.toContain("abc123");
    expect(section).toContain("[redacted: 6 chars]");
  });

  it("says so briefly when nothing qualifies", () => {
    const [section] = plugin.debugSections!();
    expect(section).toContain("## TanStack Query");
    expect(section).toMatch(/none/i);
  });
});

describe("Agent tool", () => {
  it("is read-only and exposed without agent.write", () => {
    const tools = plugin.agentTools!;
    expect(tools.map((t) => t.name)).toEqual(["devbelt_get_tanstack_query"]);
    expect(tools[0].writes).toBeFalsy();
    expect(tools[0].annotations).toMatchObject({ readOnlyHint: true });
  });

  it("returns queries and mutations with status and errors, never data", async () => {
    await client.fetchQuery({ queryKey: ["fine"], queryFn: () => ({ email: "ok@x.test" }) });
    await fail(["bad", { password: "hunter2" }], "HTTP 503");
    const out = await call("devbelt_get_tanstack_query");
    expect(out).toContain('["fine"]');
    expect(out).toContain("HTTP 503");
    expect(out).toContain("error");
    expect(out).not.toContain("ok@x.test");
    expect(out).not.toContain("hunter2");
  });

  it("filters by status and limits the count", async () => {
    await client.fetchQuery({ queryKey: ["fine"], queryFn: () => 1 });
    await fail(["bad1"], "e1");
    await fail(["bad2"], "e2");
    const errors = await call("devbelt_get_tanstack_query", { status: "error" });
    expect(errors).toContain('["bad1"]');
    expect(errors).not.toContain('["fine"]');
    const one = await call("devbelt_get_tanstack_query", { status: "error", limit: 1 });
    expect(one.match(/\["bad\d"\]/g)).toHaveLength(1);
  });
});
