// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { resolveBreakpoint } from "../src/core/breakpoints";
import { defaultPlugins, display } from "../src/plugins";
import { breakpoint } from "../src/plugins/breakpoint";
import { viewport } from "../src/plugins/viewport";
import {
  frameLoaded,
  resetViewportStore,
  setFrame,
} from "../src/plugins/viewport/store";
import { StubToolbar } from "./helpers";
import { writeString } from "../src/core/storage";
import { VIEWPORT_STORAGE_KEY } from "../src/core/viewports";
import ToolbarImpl from "../src/ui/toolbar";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLElement.prototype.showPopover ??= function () {};
HTMLElement.prototype.hidePopover ??= function () {};
Element.prototype.getAnimations ??= () => [];
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
);

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
  const Item = breakpoint().Item!;
  const { container } = render(<Item />);
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

test("the readout uses the Frame's real width, including a custom size", async () => {
  setWidth(1600);
  const user = userEvent.setup();
  const plugin = breakpoint();
  plugin.pinned = true;
  render(
    <ToolbarImpl plugins={[viewport(), display(), plugin]} isolation="none" />,
  );

  expect(screen.getByText("2xl · 1600px")).toBeTruthy();
  await user.keyboard("2");
  expect(screen.getByText("base · 390px")).toBeTruthy();
  // The Frame is scaled to fit the window. The readout stays on the
  // iframe's real width, not that smaller on-screen box.
  const frame = screen.getByTitle("Mobile viewport");
  expect((frame as HTMLElement).style.width).toBe("390px");
  expect(Number.parseFloat((frame.parentElement as HTMLElement).style.width)).toBeLessThan(390);

  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitem", { name: "Display" }));
  await user.click(screen.getByRole("switch", { name: /Rotate/ }));
  expect(screen.getByText("md · 844px")).toBeTruthy();
  await user.click(screen.getByRole("switch", { name: /Rotate/ }));
  expect(screen.getByText("base · 390px")).toBeTruthy();
  const width = screen.getByRole("textbox", { name: "Custom width" });
  await user.clear(width);
  await user.type(width, "500");
  await user.tab();

  expect(screen.getByText("base · 500px")).toBeTruthy();
  expect(screen.queryByText(/1600px/)).toBeNull();
});

test("it is opt-in", () => {
  expect(defaultPlugins().map((p) => p.id)).not.toContain("breakpoint");
});

// ---- outline-all-elements toggle ----

const OUTLINE_SELECTOR = "style[data-devbelt-outline]";

function mountOutline() {
  const Item = breakpoint().Item!;
  return render(
    <StubToolbar>
      <Item />
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

test("a base name and an initial outline are options", () => {
  setWidth(400);
  const Item = breakpoint({ base: "xs", outline: true }).Item!;
  const view = render(
    <StubToolbar>
      <Item />
    </StubToolbar>,
  );
  expect(screen.getByText("xs · 400px")).toBeTruthy();
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeTruthy();
  expect(view.getByRole("button", { name: /outline/i }).getAttribute("aria-pressed")).toBe(
    "true",
  );
});

test("a saved outline choice wins over the initial outline option", () => {
  writeString("breakpoint-outline", "0");
  const Item = breakpoint({ outline: true }).Item!;
  const view = render(
    <StubToolbar>
      <Item />
    </StubToolbar>,
  );
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeNull();
  expect(view.getByRole("button", { name: /outline/i }).getAttribute("aria-pressed")).toBe(
    "false",
  );
});

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

test("unpinning hides the readout and the outline toggle, and the outline stops", async () => {
  setWidth(812);
  const user = userEvent.setup();
  const plugin = breakpoint();
  plugin.pinned = true;
  render(<ToolbarImpl plugins={[viewport(), plugin]} isolation="none" />);

  expect(screen.getByText("md · 812px")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /outline/i }));
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Breakpoint" }));

  expect(screen.queryByText("md · 812px")).toBeNull();
  expect(screen.queryByRole("button", { name: /outline/i })).toBeNull();
  expect(document.querySelector(OUTLINE_SELECTOR)).toBeNull();
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
