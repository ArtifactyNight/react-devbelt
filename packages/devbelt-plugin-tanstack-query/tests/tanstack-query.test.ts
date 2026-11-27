import { QueryClient } from "@tanstack/react-query";
import { definePlugin } from "react-devbelt";
import { describe, expect, it } from "vitest";

import { tanstackQuery } from "../src";

describe("tanstackQuery(queryClient)", () => {
  it("returns a valid Plugin built on the public API", () => {
    const plugin = tanstackQuery(new QueryClient());

    expect(plugin.apiVersion).toBe(1);
    expect(plugin.id).toBe("tanstack-query");
    expect(plugin.name).toBe("TanStack Query");
    // re-validating through the host's own entry point must not throw
    expect(() => definePlugin(plugin)).not.toThrow();
  });

  it("has a window and a read Agent tool, and no write tools", () => {
    const plugin = tanstackQuery(new QueryClient());

    expect(plugin.window).toBeDefined();
    expect(plugin.agentTools?.every((tool) => !tool.writes)).toBe(true);
  });

  it("requires the client to be passed explicitly", () => {
    // @ts-expect-error the client is a required argument
    expect(() => tanstackQuery()).toThrow(/QueryClient/);
  });
});
