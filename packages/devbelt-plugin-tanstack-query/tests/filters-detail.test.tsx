// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const renderWindow = () => {
  const Window = plugin.window!.Component;
  return render(<Window />);
};

const release = (target: DevBeltPlugin) => {
  const stop = target.install?.();
  if (typeof stop === "function") stop();
};

describe("filters", () => {
  it("narrows the active tab by text", async () => {
    await client.fetchQuery({ queryKey: ["todos"], queryFn: () => ["a"] });
    await client.fetchQuery({ queryKey: ["users"], queryFn: () => ["b"] });
    renderWindow();

    fireEvent.change(screen.getByRole("searchbox", { name: "Filter" }), { target: { value: "todo" } });

    expect(screen.getByRole("row", { name: /\["todos"\]/ })).toBeTruthy();
    expect(screen.queryByRole("row", { name: /\["users"\]/ })).toBeNull();
  });

  it("narrows the active tab by status, including the Mutations tab", async () => {
    await client.fetchQuery({ queryKey: ["todos"], queryFn: () => ["a"] });
    await fail(["users"], "missing");
    await client
      .getMutationCache()
      .build(client, { mutationKey: ["save"], mutationFn: () => Promise.reject(new Error("save failed")) })
      .execute({ name: "Ada" })
      .catch(() => {});
    await client
      .getMutationCache()
      .build(client, { mutationKey: ["ping"], mutationFn: async () => 1 })
      .execute(undefined);
    renderWindow();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "error" } });

    expect(screen.getByRole("row", { name: /\["users"\]/ })).toBeTruthy();
    expect(screen.queryByRole("row", { name: /\["todos"\]/ })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Mutations" }));

    expect(screen.getByRole("row", { name: /\["save"\]/ })).toBeTruthy();
    expect(screen.queryByRole("row", { name: /\["ping"\]/ })).toBeNull();
    expect(screen.queryByRole("row", { name: /\["users"\]/ })).toBeNull();
  });
});

describe("failed rows", () => {
  it("marks a failed query and a failed mutation, not only by sorting them first", async () => {
    await client.fetchQuery({ queryKey: ["todos"], queryFn: () => ["a"] });
    await fail(["users"], "missing");
    await client
      .getMutationCache()
      .build(client, { mutationKey: ["save"], mutationFn: () => Promise.reject(new Error("save failed")) })
      .execute(undefined)
      .catch(() => {});
    renderWindow();

    expect(screen.getByRole("row", { name: /\["users"\]/ }).textContent).toMatch(/Failed/);
    expect(screen.getByRole("row", { name: /\["todos"\]/ }).textContent).not.toMatch(/Failed/);

    fireEvent.click(screen.getByRole("tab", { name: "Mutations" }));
    expect(screen.getByRole("row", { name: /\["save"\]/ }).textContent).toMatch(/Failed/);
  });
});

describe("mutation variables", () => {
  it("summarises variables on the row, redacts secrets, and keeps them out of the Debug bundle", async () => {
    await client
      .getMutationCache()
      .build(client, { mutationKey: ["save"], mutationFn: async () => 1 })
      .execute({ name: "Ada", password: "hunter2hunter2" });
    const long = `${"V".repeat(120)}VAR_END`;
    await client
      .getMutationCache()
      .build(client, { mutationKey: ["bulk"], mutationFn: async () => 1 })
      .execute({ note: long });
    renderWindow();
    fireEvent.click(screen.getByRole("tab", { name: "Mutations" }));

    const save = screen.getByRole("row", { name: /\["save"\]/ });
    expect(save.textContent).toContain("Ada");
    expect(save.textContent).not.toContain("hunter2hunter2");
    expect(save.textContent).toContain("[redacted: 14 chars]");

    const bulk = screen.getByRole("row", { name: /\["bulk"\]/ });
    expect(bulk.textContent).toContain("note");
    expect(bulk.textContent).not.toContain("VAR_END");

    const bundle = plugin.debugSections!().join("\n");
    expect(bundle).not.toContain("Ada");
    expect(bundle).not.toContain("hunter2hunter2");
    expect(bundle).not.toContain("VAR_END");
  });
});

describe("row detail", () => {
  it("shows the full key, redacted data and the error stack, and keeps both out of the Debug bundle", async () => {
    await client.fetchQuery({
      queryKey: ["me", { id: 1 }],
      queryFn: () => ({ name: "Ada", token: "s3cr3t-value" }),
    });
    const error = new Error("boom 500");
    error.stack = "boom 500\n    at explode (demo.js:10:2)";
    await client.fetchQuery({ queryKey: ["user", 7], queryFn: () => Promise.reject(error) }).catch(() => {});
    renderWindow();

    fireEvent.click(screen.getByRole("row", { name: /\["me"/ }));
    const dataDetail = screen.getByRole("region", { name: "Details" });
    expect(dataDetail.textContent).toContain('["me",{"id":1}]');
    expect(dataDetail.textContent).toContain("Ada");
    expect(dataDetail.textContent).not.toContain("s3cr3t-value");
    expect(dataDetail.textContent).toContain("[redacted: 12 chars]");

    fireEvent.click(screen.getByRole("row", { name: /\["user",7\]/ }));
    const errorDetail = screen.getByRole("region", { name: "Details" });
    expect(errorDetail.textContent).toContain('["user",7]');
    expect(errorDetail.textContent).toContain("at explode (demo.js:10:2)");
    expect(screen.getByRole("row", { name: /\["user",7\]/ }).textContent).not.toContain("demo.js");

    const bundle = plugin.debugSections!().join("\n");
    expect(bundle).not.toContain("Ada");
    expect(bundle).not.toContain("s3cr3t-value");
    expect(bundle).not.toContain("demo.js");
  });

  it("shortens large data until it is expanded", async () => {
    const note = `${"A".repeat(1200)}SENTINEL_END`;
    await client.fetchQuery({ queryKey: ["blob"], queryFn: () => ({ note }) });
    renderWindow();

    fireEvent.click(screen.getByRole("row", { name: /\["blob"\]/ }));
    expect(screen.getByRole("region", { name: "Details" }).textContent).not.toContain("SENTINEL_END");

    fireEvent.click(screen.getByRole("button", { name: "Show full data" }));
    expect(screen.getByRole("region", { name: "Details" }).textContent).toContain("SENTINEL_END");
  });
});

describe("ambiguous keys", () => {
  it("flags queries that print as the same key and still opens each one's own data", async () => {
    await client.fetchQuery({
      queryKey: ["item", 1],
      queryKeyHashFn: () => "hash-a",
      queryFn: () => "one",
    });
    await client.fetchQuery({
      queryKey: ["item", 1],
      queryKeyHashFn: () => "hash-b",
      queryFn: () => "two",
    });
    renderWindow();

    const rows = screen.getAllByRole("row", { name: /\["item",1\]/ });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.textContent).toContain("Ambiguous key");

    fireEvent.click(rows[0]);
    const first = screen.getByRole("region", { name: "Details" }).textContent ?? "";
    fireEvent.click(rows[1]);
    const second = screen.getByRole("region", { name: "Details" }).textContent ?? "";
    expect(first.includes("one") && second.includes("two") || first.includes("two") && second.includes("one")).toBe(true);
    expect(first.includes("one") && first.includes("two")).toBe(false);
    expect(second.includes("one") && second.includes("two")).toBe(false);
  });
});

describe("Plugin id", () => {
  it("throws a clear error when two clients use the same id", () => {
    const first = tanstackQuery(new QueryClient(), { id: "orders" });
    try {
      expect(() => tanstackQuery(new QueryClient(), { id: "orders" })).toThrow(
        /two clients use the Plugin id "orders"/,
      );
    } finally {
      release(first);
    }
  });

  it("accepts two clients with distinct ids", () => {
    const first = tanstackQuery(new QueryClient(), { id: "orders" });
    const second = tanstackQuery(new QueryClient(), { id: "orders-admin" });
    expect(first.id).toBe("orders");
    expect(second.id).toBe("orders-admin");
    release(first);
    release(second);
  });
});
