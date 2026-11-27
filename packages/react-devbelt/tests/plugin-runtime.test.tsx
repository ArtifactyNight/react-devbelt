// @vitest-environment jsdom

import { afterEach, expect, test, vi } from "vitest";

import { definePlugin } from "../src/plugin";
import { installPlugins } from "../src/install-plugins";
import { withDevBelt } from "../src/next";
import { registerAgentTools, text } from "../src/core/agent-tools";

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__devbeltInstalled;
  delete (window as unknown as Record<string, unknown>).devbelt;
});

const icon = null;

test("definePlugin stamps the API version and checks the id", () => {
  expect(definePlugin({ id: "my-plugin", name: "Mine", icon }).apiVersion).toBe(1);
  expect(() => definePlugin({ id: "My Plugin", name: "x", icon })).toThrow(/plugin id/);
  expect(() =>
    definePlugin({ id: "ok", name: "x", icon, apiVersion: 2 as never }),
  ).toThrow(/plugin API/);
});

test("a plugin installs once however many callers ask, and cleans up with the last", () => {
  const cleanup = vi.fn();
  const install = vi.fn(() => cleanup);
  const plugin = definePlugin({ id: "once", name: "Once", icon, install });

  const a = installPlugins([plugin]);
  const b = installPlugins([plugin]);
  expect(install).toHaveBeenCalledTimes(1);

  a();
  expect(cleanup).not.toHaveBeenCalled();
  b();
  expect(cleanup).toHaveBeenCalledTimes(1);
  b(); // letting go twice is harmless
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("a plugin that throws while installing doesn't stop the others", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const good = vi.fn();
  installPlugins([
    definePlugin({
      id: "bad",
      name: "Bad",
      icon,
      install() {
        throw new Error("nope");
      },
    }),
    definePlugin({ id: "good", name: "Good", icon, install: good }),
  ]);
  expect(good).toHaveBeenCalled();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("agent tools are callable from window.devbelt with the host's context", async () => {
  const off = registerAgentTools(
    [
      {
        name: "echo",
        description: "",
        inputSchema: {},
        run: (input, ctx: string) => text(`${ctx}:${String(input.v)}`),
      },
    ],
    () => "ctx",
  );
  const tools = (window as unknown as { devbelt: Record<string, (i?: object) => unknown> }).devbelt;
  expect(await tools.echo({ v: 1 })).toEqual(text("ctx:1"));
  off();
  expect((window as unknown as { devbelt?: unknown }).devbelt).toBeUndefined();
});

test("withDevBelt adds the install module once and keeps the rest", () => {
  const once = withDevBelt({ reactStrictMode: true });
  expect(once).toEqual({
    reactStrictMode: true,
    instrumentationClientInject: ["react-devbelt/install"],
  });
  expect(withDevBelt(once)).toBe(once);
  expect(
    withDevBelt({ instrumentationClientInject: ["./mine.js"] })
      .instrumentationClientInject,
  ).toEqual(["./mine.js", "react-devbelt/install"]);
});
