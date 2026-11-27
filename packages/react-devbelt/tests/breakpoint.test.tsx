// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { resolveBreakpoint } from "../src/core/breakpoints";
import { defaultPlugins } from "../src/plugins";
import { breakpoint } from "../src/plugins/breakpoint";
import {
  frameLoaded,
  resetViewportStore,
  setFrame,
} from "../src/plugins/viewport/store";
import { StubToolbar } from "./helpers";
import { writeString } from "../src/core/storage";
import { VIEWPORT_STORAGE_KEY } from "../src/core/viewports";

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  cleanup();
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
    { label: "Breakpoint", value: "base · 390px (Frame width)" },
  ]);
});

test("it is opt-in", () => {
  expect(defaultPlugins().map((p) => p.id)).not.toContain("breakpoint");
});

// ---- outline-all-elements toggle ----

const OUTLINE_SELECTOR = "style[data-devbelt-outline]";

function mountOutline() {
  const plugin = breakpoint();
  const Item = plugin.Item!;
  const Overlay = plugin.Overlay!;
  return render(
    <StubToolbar>
      <Item />
      <Overlay />
    </StubToolbar>,
  );
}

function toggle(view: ReturnType<typeof mountOutline>) {
  fireEvent.click(view.getByRole("button", { name: /outline/i }));
}

test("toggling on outlines page elements, toggling off removes it completely", () => {
  const view = mountOutline();
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeNull();
  toggle(view);
  const style = document.querySelector(OUTLINE_SELECTOR)!;
  expect(style).toBeTruthy();
  expect(style.textContent).toMatch(/outline/);
  toggle(view);
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeNull();
});

test("the outline rule skips the toolbar and its Windows", () => {
  const view = mountOutline();
  toggle(view);
  const css = document.querySelector(OUTLINE_SELECTOR)!.textContent!;
  for (const skipped of ["devbelt-root", "[data-devbelt]", "[data-devbelt-window]"]) {
    expect(css).toContain(`:not(${skipped})`);
    expect(css).toContain(`:not(${skipped} *)`);
  }
});

test("unmounting while on removes the outline", () => {
  const view = mountOutline();
  toggle(view);
  view.unmount();
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeNull();
});

test("the outline is also applied inside the Frame, and follows reloads", () => {
  writeString(VIEWPORT_STORAGE_KEY, "mobile");
  const frame = document.createElement("iframe");
  document.body.append(frame);
  setFrame(frame);
  const view = mountOutline();
  toggle(view);
  const frameDoc = frame.contentDocument!;
  expect(frameDoc.querySelector(OUTLINE_SELECTOR)).toBeTruthy();
  // a reload replaces the Frame's document; the outline must come back
  frameDoc.open();
  frameDoc.write("<html><body></body></html>");
  frameDoc.close();
  act(() => frameLoaded());
  expect(frame.contentDocument!.querySelector(OUTLINE_SELECTOR)).toBeTruthy();
  toggle(view);
  expect(frame.contentDocument!.querySelector(OUTLINE_SELECTOR)).toBeNull();
  frame.remove();
});

// ---- review fixes ----

test("invalid breakpoints throw at creation, naming the entry", () => {
  expect(() => breakpoint({ breakpoints: { tablet: 0 } })).toThrow(/tablet/);
  expect(() => breakpoint({ breakpoints: { tablet: -5 } })).toThrow(/tablet/);
  expect(() => breakpoint({ breakpoints: { tablet: "wide" } })).toThrow(/tablet/);
  expect(() => breakpoint({ breakpoints: { tablet: "40em" } })).toThrow(/tablet/);
  expect(() => breakpoint({ breakpoints: { tablet: Number.NaN } })).toThrow(/tablet/);
  expect(() => breakpoint({ breakpoints: { a: 600, " a": 700 } })).toThrow(/a/);
  expect(() => breakpoint({ breakpoints: { base: 600 } })).toThrow(/base/);
  expect(() => breakpoint({ breakpoints: { tablet: "40rem", desktop: 1100 } })).not.toThrow();
});

test("a read-only Agent tool reports breakpoint, width, declared breakpoints and outline state", async () => {
  setWidth(812);
  const plugin = breakpoint();
  const tool = plugin.agentTools!.find((t) => t.name === "devbelt_get_breakpoint")!;
  expect(tool.annotations?.readOnlyHint).toBe(true);
  expect(plugin.agentTools!.every((t) => !t.writes)).toBe(true);
  const out = (await tool.run({}, undefined as never)).content[0].text;
  expect(out).toMatch(/md/);
  expect(out).toMatch(/812/);
  expect(out).toMatch(/2xl.*1536|1536.*2xl/);
  expect(out).toMatch(/outline.*off/i);
});

test("the Debug line notes when the width is the Frame's", () => {
  setWidth(1600);
  writeString(VIEWPORT_STORAGE_KEY, "mobile");
  expect(breakpoint().debugContext!()[0].value).toMatch(/frame/i);
  resetViewportStore();
  localStorage.clear();
  sessionStorage.clear();
  setWidth(900);
  expect(breakpoint().debugContext!()[0].value).not.toMatch(/frame/i);
});

test("the outline setting survives a reload", () => {
  const first = mountOutline();
  toggle(first);
  first.unmount();
  const second = mountOutline();
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeTruthy();
  expect(second.getByRole("button", { name: /outline/i }).getAttribute("aria-pressed")).toBe("true");
  toggle(second);
  second.unmount();
  mountOutline();
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeNull();
});
