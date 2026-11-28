// @vitest-environment jsdom

import {
  act,
  cleanup,
  render as rtlRender,
  screen,
  type RenderOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DevGrabPicker } from "../src/plugins/grab/dev-grab-picker";
import { StubToolbar } from "./helpers";

const render = (ui: React.ReactElement, options?: RenderOptions) =>
  rtlRender(ui, { wrapper: StubToolbar, ...options });

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
Element.prototype.setPointerCapture = function () {};
Element.prototype.releasePointerCapture = function () {};
Element.prototype.hasPointerCapture = () => false;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
);

// What the pointer is over, and what was copied, are driven by the test.
const state = vi.hoisted(() => ({
  under: null as Element | null,
  copied: [] as string[],
  region: [] as Element[],
}));

vi.mock("react-grab/primitives", () => ({
  isElementGrabbable: () => true,
  getElementAtPoint: (x: number, y: number) => {
    // a region sweep samples a grid; a click hits state.under
    return state.region.length > 0 && (x !== 10 || y !== 10)
      ? (state.region[Math.floor(x / 100) % state.region.length] ?? null)
      : state.under;
  },
  getElementBounds: (el: Element) => {
    const index = Number((el as HTMLElement).dataset.n ?? 0);
    return {
      x: 100 + index * 120,
      y: 80,
      width: 100,
      height: 40,
      borderRadius: "0",
    };
  },
  getElementContext: async (el: Element) => ({
    snippet: `<${el.tagName.toLowerCase()}>${el.textContent}</${el.tagName.toLowerCase()}>`,
    componentName: null,
  }),
  copyContent: (text: string) => {
    state.copied.push(text);
    return true;
  },
}));

function target(tag: string, n: number, text: string) {
  const el = document.createElement(tag);
  el.dataset.n = String(n);
  el.textContent = text;
  document.body.append(el);
  return el;
}

const overlay = () =>
  document.body.querySelector<HTMLElement>(".cursor-crosshair")!;

async function click(
  user: ReturnType<typeof userEvent.setup>,
  el: Element | null,
  modifier?: "Meta" | "Control",
) {
  state.under = el;
  if (modifier) await user.keyboard(`{${modifier}>}`);
  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: overlay(),
      coords: { clientX: 10, clientY: 10 },
    },
    {
      keys: "[/MouseLeft]",
      target: overlay(),
      coords: { clientX: 10, clientY: 10 },
    },
  ]);
  if (modifier) await user.keyboard(`{/${modifier}}`);
}

const onDone = vi.fn();

beforeEach(() => {
  state.under = null;
  state.copied = [];
  state.region = [];
  onDone.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.querySelectorAll("[data-n]").forEach((n) => n.remove());
});

test("a copy is reported with its text, so Grab can hand it to an AI tool", async () => {
  const user = userEvent.setup();
  const onCopied = vi.fn();
  render(
    <DevGrabPicker viewportLabel="Mobile" onCopied={onCopied} onDone={onDone} />,
  );
  await click(user, target("button", 0, "Save"));

  await vi.waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  expect(onCopied.mock.calls[0][0]).toBe(state.copied[0]);
  await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith("copied"));
});

test("a plain click still copies the one element straight away", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Mobile" onDone={onDone} />);
  await click(user, target("button", 0, "Save"));

  await vi.waitFor(() => {
    expect(state.copied).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith("copied"); // lands after the copy; wait so it cannot leak into the next test
  });
  expect(state.copied[0]).toMatch(
    /^\[viewport: Mobile \d+×\d+, dpr \d+\]\n<button>Save<\/button>$/,
  );
});

test("⌘+click selects an element and opens a popover for its context", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "Save"), "Meta");

  expect(state.copied).toHaveLength(0);
  expect(
    screen.getByRole("button", { name: "Add context to selection 1" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: "Context for selection 1" }),
  ).toBeTruthy();
  expect(screen.getByText("1 selected")).toBeTruthy();
});

test("several elements, each with its own note, are copied numbered", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="iPad" onDone={onDone} />);
  const save = target("button", 0, "Save");
  const title = target("h1", 1, "Orders");
  const total = target("span", 2, "$12");

  await click(user, save, "Control");
  await user.type(
    screen.getByRole("textbox", { name: "Context for selection 1" }),
    "Make this bigger{Enter}",
  );
  expect(
    screen.queryByRole("textbox", { name: "Context for selection 1" }),
  ).toBeNull();

  await click(user, title, "Control");
  await user.keyboard("{Escape}");
  expect(onDone).not.toHaveBeenCalled();

  await click(user, total, "Control");
  await user.type(
    screen.getByRole("textbox", { name: "Context for selection 3" }),
    "Wrong currency{Shift>}{Enter}{/Shift}symbol{Enter}",
  );

  expect(screen.getByText("3 selected")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Copy selection" }));
  await vi.waitFor(() => {
    expect(state.copied).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith("copied"); // lands after the copy; wait so it cannot leak into the next test
  });

  const text = state.copied[0];
  expect(text).toMatch(/^\[viewport: iPad \d+×\d+, dpr \d+, 3 elements\]\n/);
  expect(text).toContain(
    "1. <button>Save</button>\n   Context: Make this bigger",
  );
  expect(text).toContain("2. <h1>Orders</h1>\n\n3. <span>$12</span>");
  expect(text).toContain("   Context: Wrong currency\n   symbol");
});

test("Enter copies the selection once no note is being edited", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "A"), "Meta");
  await user.keyboard("{Escape}");
  await user.keyboard("{Enter}");
  await vi.waitFor(() => {
    expect(state.copied).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith("copied"); // lands after the copy; wait so it cannot leak into the next test
  });
  expect(state.copied[0]).toContain("1. <button>A</button>");
});

test("⌘+click on a selected element takes it back out", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  const el = target("button", 0, "A");
  await click(user, el, "Meta");
  expect(screen.getByText("1 selected")).toBeTruthy();
  await click(user, el, "Meta");
  expect(screen.queryByText(/selected/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Add context/ })).toBeNull();
});

test("Remove in the popover drops that selection and renumbers the rest", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "A"), "Meta");
  await user.keyboard("{Escape}");
  await click(user, target("button", 1, "B"), "Meta");
  await user.click(screen.getByRole("button", { name: "Remove selection 2" }));

  expect(screen.getByText("1 selected")).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: /Add context to selection/ }),
  ).toHaveLength(1);
});

test("a plain click with a selection copies it plus the clicked element", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "A"), "Meta");
  await user.keyboard("{Escape}");
  await click(user, target("button", 1, "B"));
  await vi.waitFor(() => {
    expect(state.copied).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith("copied"); // lands after the copy; wait so it cannot leak into the next test
  });
  expect(state.copied[0]).toContain(
    "1. <button>A</button>\n\n2. <button>B</button>",
  );
  expect(state.copied[0]).toMatch(/2 elements\]/);
});

test("Escape closes an open note first, then leaves Grab", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "A"), "Meta");
  await user.keyboard("{Escape}");
  expect(onDone).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(onDone).toHaveBeenCalledWith("cancelled");
  expect(state.copied).toHaveLength(0);
});

test("recent problems are appended after the numbered selection", async () => {
  const user = userEvent.setup();
  render(
    <DevGrabPicker
      viewportLabel="Full"
      appendix={() => "## Recent problems (last 5 minutes)"}
      onDone={onDone}
    />,
  );
  await click(user, target("button", 0, "A"), "Meta");
  await user.keyboard("{Escape}");
  await user.keyboard("{Enter}");
  await vi.waitFor(() => {
    expect(state.copied).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith("copied"); // lands after the copy; wait so it cannot leak into the next test
  });
  expect(state.copied[0]).toMatch(/<button>A<\/button>\n\n## Recent problems/);
});

test("the selected elements get numbered markers a screen reader can reach", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "A"), "Meta");
  await user.keyboard("{Escape}");
  await click(user, target("button", 1, "B"), "Meta");
  await user.keyboard("{Escape}");

  const markers = screen.getAllByRole("button", {
    name: /Add context to selection/,
  });
  expect(markers.map((m) => m.textContent)).toEqual(["1", "2"]);

  await act(async () => markers[0].focus());
  await user.keyboard("{Enter}");
  expect(state.copied).toHaveLength(0);
  expect(
    screen.getByRole("textbox", { name: "Context for selection 1" }),
  ).toBeTruthy();
});

test("⌘/Ctrl+Enter copies from inside a note, with the note's latest text", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await click(user, target("button", 0, "Pay"), "Meta");
  await user.type(
    screen.getByRole("textbox", { name: "Context for selection 1" }),
    "Disabled state looks active",
  );
  await user.keyboard("{Control>}{Enter}{/Control}");
  await vi.waitFor(() => {
    expect(state.copied).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith("copied"); // lands after the copy; wait so it cannot leak into the next test
  });
  expect(state.copied[0]).toContain("Context: Disabled state looks active");
});

const guide = () => screen.queryByRole("note", { name: "How Grab works" });

test("starting Grab shows the full guide with every gesture", () => {
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  const card = guide()!;
  expect(card).toBeTruthy();
  expect(card.textContent).toContain("Copy the element under the cursor");
  expect(card.textContent).toContain("Copy everything inside a rectangle");
  expect(card.textContent).toContain("Select several elements");
  expect(card.textContent).toContain("Press G to turn Grab on or off");
  expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
});

test("Got it shrinks the guide to one line and remembers it", async () => {
  const user = userEvent.setup();
  const first = render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  await user.click(screen.getByRole("button", { name: "Got it" }));

  expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  expect(guide()!.textContent).toContain("Click to copy");
  expect(guide()!.textContent).toContain("Esc cancels");
  first.unmount();

  // the next time Grab starts, it opens in the short form
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  expect(guide()!.textContent).toContain("Click to copy");

  await user.click(screen.getByRole("button", { name: "Show how Grab works" }));
  expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
});

test("the guide gets out of the way once something is selected", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  expect(guide()).toBeTruthy();
  await click(user, target("button", 0, "A"), "Meta");
  expect(guide()).toBeNull();
  expect(screen.getByText("1 selected")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Remove selection 1" }));
  expect(guide()).toBeTruthy();
});

test("hovering says what a click will do", async () => {
  const user = userEvent.setup();
  render(<DevGrabPicker viewportLabel="Full" onDone={onDone} />);
  const el = target("button", 0, "A");
  state.under = el;
  await user.pointer({
    target: overlay(),
    coords: { clientX: 10, clientY: 10 },
  });
  expect(screen.getByText(/button · 100×40 · click to copy/)).toBeTruthy();

  await click(user, el, "Meta");
  await user.keyboard("{Escape}");
  state.under = target("h1", 1, "B");
  await user.pointer({
    target: overlay(),
    coords: { clientX: 11, clientY: 11 },
  });
  expect(screen.getByText(/h1 · 100×40 · ⌘\/Ctrl\+click to add/)).toBeTruthy();
});
