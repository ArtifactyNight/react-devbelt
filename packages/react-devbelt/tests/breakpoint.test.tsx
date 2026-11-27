// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { resolveBreakpoint } from "../src/core/breakpoints";
import { defaultPlugins } from "../src/plugins";
import { breakpoint } from "../src/plugins/breakpoint";
import { resetViewportStore } from "../src/plugins/viewport/store";
import { writeString } from "../src/core/storage";
import { VIEWPORT_STORAGE_KEY } from "../src/core/viewports";

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  resetViewportStore();
  sessionStorage.clear();
  localStorage.clear();
});

test("widths resolve against Tailwind v4's breakpoints by default", () => {
  expect(resolveBreakpoint(500)).toBe("base");
  expect(resolveBreakpoint(640)).toBe("sm");
  expect(resolveBreakpoint(812)).toBe("md");
  expect(resolveBreakpoint(1024)).toBe("lg");
  expect(resolveBreakpoint(1280)).toBe("xl");
  expect(resolveBreakpoint(1920)).toBe("2xl");
});

test("an app's own breakpoints replace the defaults, in rem or px", () => {
  const own = { tablet: "40rem", desktop: 1100 };
  expect(resolveBreakpoint(500, own)).toBe("base");
  expect(resolveBreakpoint(700, own)).toBe("tablet");
  expect(resolveBreakpoint(1100, own)).toBe("desktop");
});

test("the Toolbar shows the breakpoint and width and follows resizes", () => {
  setWidth(812);
  const Status = breakpoint().Status!;
  const { container } = render(<Status />);
  expect(container.textContent).toBe("md · 812px");
  act(() => setWidth(1300));
  expect(container.textContent).toBe("xl · 1300px");
});

test("the Debug bundle carries the breakpoint and width", () => {
  setWidth(390);
  const ctx = breakpoint().debugContext?.();
  expect(ctx).toEqual([{ label: "Breakpoint", value: "base · 390px" }]);
});

test("inside the Frame it reports the Frame's width, not the window's", () => {
  setWidth(1600);
  writeString(VIEWPORT_STORAGE_KEY, "mobile");
  const plugin = breakpoint();
  expect(plugin.debugContext?.()).toEqual([
    { label: "Breakpoint", value: "base · 390px" },
  ]);
});

test("it is opt-in", () => {
  expect(defaultPlugins().map((p) => p.id)).not.toContain("breakpoint");
});
