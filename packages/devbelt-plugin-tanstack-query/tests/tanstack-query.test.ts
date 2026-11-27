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

  it("is opt-in and empty for now: no window, item or agent tools", () => {
    const plugin = tanstackQuery(new QueryClient());

    expect(plugin.window).toBeUndefined();
    expect(plugin.run).toBeUndefined();
    expect(plugin.agentTools ?? []).toEqual([]);
  });

  it("requires the client to be passed explicitly", () => {
    // @ts-expect-error the client is a required argument
    expect(() => tanstackQuery()).toThrow(/QueryClient/);
  });
});
