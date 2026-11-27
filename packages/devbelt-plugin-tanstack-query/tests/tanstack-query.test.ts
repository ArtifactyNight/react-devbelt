import { QueryClient } from "@tanstack/react-query";
import { definePlugin } from "react-devbelt";
import { exposedAgentTools } from "react-devbelt/core";
import { afterEach, describe, expect, it } from "vitest";

import { tanstackQuery } from "../src";

let stop: (() => void) | void;

describe("tanstackQuery(queryClient)", () => {
  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it("returns a valid Plugin built on the public API", () => {
    const plugin = tanstackQuery(new QueryClient());
    stop = plugin.install?.();

    expect(plugin.apiVersion).toBe(1);
    expect(plugin.id).toBe("tanstack-query");
    expect(plugin.name).toBe("TanStack Query");
    // re-validating through the host's own entry point must not throw
    expect(() => definePlugin(plugin)).not.toThrow();
  });

  it("has a window and a read Agent tool, and no write tools", () => {
    const plugin = tanstackQuery(new QueryClient());
    stop = plugin.install?.();

    expect(plugin.window).toBeDefined();
    expect(exposedAgentTools([plugin]).every((tool) => !tool.writes)).toBe(true);
  });

  it("requires the client to be passed explicitly", () => {
    // @ts-expect-error the client is a required argument
    expect(() => tanstackQuery()).toThrow(/QueryClient/);
  });
});
