// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { createAgent } from "@ui-sdk/react/agent";

import type { DevBeltPlugin } from "../src/plugin";
import { defaultPlugins, display, setGrabbing } from "../src/plugins";
import { resetViewportStore } from "../src/plugins/viewport/store";
import ToolbarImpl from "../src/ui/toolbar";

// Rendered without a shadow root so Testing Library can see inside it.
function DevViewportSwitcher({
  plugins,
}: {
  plugins?: readonly DevBeltPlugin[];
}) {
  return (
    <ToolbarImpl plugins={plugins ?? defaultPlugins()} isolation="none" />
  );
}
import {
  clearConsoleLog,
  installConsoleLog,
} from "../src/core/console-log";
import {
  clearNetworkLog,
  installNetworkLog,
} from "../src/core/network-log";

const grabProps: { current: { appendix?: () => string } | null } = {
  current: null,
};

// Like the real picker, the stand-in holds Esc while it is on screen.
vi.mock("../src/plugins/grab/dev-grab-picker", async () => {
  const { useEffect } = await import("react");
  const { useToolbar } = await import("../src/ui/context");
  return {
    DevGrabPicker: (props: { appendix?: () => string }) => {
      grabProps.current = props;
      const { holdEscape } = useToolbar();
      useEffect(() => holdEscape(), [holdEscape]);
      return null;
    },
  };
});

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

class FakeXhr extends EventTarget {
  status = 0;
  nextStatus = 200;
  responseType: XMLHttpRequestResponseType = "";
  responseText = "";
  open() {}
  setRequestHeader() {}
  send() {
    this.status = this.nextStatus;
    this.responseText = '{"ok":true}';
    this.dispatchEvent(new Event("loadend"));
  }
  getAllResponseHeaders() {
    return "";
  }
}

const consoleSink = vi.fn();

beforeAll(() => {
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  installNetworkLog();
  console.error = consoleSink;
  console.warn = consoleSink;
  installConsoleLog();
});

afterEach(() => {
  cleanup();
  // plugin state lives in module-level stores, so forget it between tests
  resetViewportStore();
  setGrabbing(false);
  clearNetworkLog();
  clearConsoleLog();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.cookie = "locale=; path=/; max-age=0";
});

// Tools that aren't pinned to the toolbar are reached from More tools.
async function fromMenu(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitem", { name }));
}

const pressed = (name: string) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

test("number keys 1–5 switch the viewport", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  expect(pressed("Full")).toBe("true");
  expect(screen.queryByTitle(/viewport$/)).toBeNull();

  await user.keyboard("3");
  expect(pressed("iPad")).toBe("true");
  const frame = screen.getByTitle("iPad viewport");
  expect(frame.style.width).toBe("820px");

  await user.keyboard("2");
  expect(screen.getByTitle("Mobile viewport").style.width).toBe("390px");

  await user.keyboard("1");
  expect(pressed("Full")).toBe("true");
  expect(screen.queryByTitle(/viewport$/)).toBeNull();
});

test("clicking a viewport toggle frames the page and persists", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  await user.click(screen.getByRole("button", { name: "PC" }));
  expect(screen.getByTitle("PC viewport")).toBeTruthy();
  expect(window.localStorage.getItem("devbelt:viewport")).toBe("pc");
});

test("the network panel lists requests and shows the response body", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  act(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", "https://api.test/api/v1/tickets/9");
    xhr.send('{"status":"done"}');
  });

  await user.click(screen.getByRole("button", { name: "Network requests" }));
  const option = screen.getByRole("option", {
    name: /PATCH.*\/api\/v1\/tickets\/9/,
  });
  await user.click(option);
  expect(screen.getByRole("tabpanel").textContent).toContain('"ok": true');

  await user.click(screen.getByRole("tab", { name: "Request" }));
  expect(screen.getByRole("tabpanel").textContent).toContain(
    '"status": "done"',
  );
});

test("an agent can find every toolbar control and switch the viewport", async () => {
  render(<DevViewportSwitcher />);
  const agent = createAgent();

  const components = agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) {
    expect(
      entry.label,
      `${entry.component} ${entry.ref} has no name`,
    ).toBeTruthy();
  }
  const labels = components.map((entry) => entry.label);
  for (const label of [
    "Dev tools",
    "Viewport",
    "Grab element",
    "Network requests",
    "Console errors and warnings",
    "More tools",
    "Move dev tools",
  ]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label);
  }

  const viewport = components.find((entry) => entry.label === "Viewport");
  expect(viewport?.actions).toContain("setValue");

  const result = await agent.act({
    steps: [{ ref: "Viewport", action: "setValue", args: [["mobile"]] }],
  });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByTitle("Mobile viewport")).toBeTruthy();
});

test("the arrow hides and shows the toolbar and remembers it", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  const toolbar = screen.getByRole("toolbar", { name: "Dev tools" });
  expect(toolbar.hasAttribute("inert")).toBe(false);

  await user.click(screen.getByRole("button", { name: "Hide dev tools" }));
  expect(toolbar.hasAttribute("inert")).toBe(true);
  expect(window.localStorage.getItem("devbelt:collapsed")).toBe("1");

  await user.click(screen.getByRole("button", { name: "Show dev tools" }));
  expect(toolbar.hasAttribute("inert")).toBe(false);
});

test("request and response bodies render as highlighted JSON", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  act(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.test/api/v1/tickets");
    xhr.send('{"title":"Hi","count":3,"done":false}');
  });
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("option", { name: /POST.*tickets/ }));

  const panel = screen.getByRole("tabpanel");
  expect(panel.querySelector(".hljs-attr")?.textContent).toBe('"ok"');
  expect(panel.querySelector(".hljs-literal")?.textContent).toBe("true");

  await user.click(screen.getByRole("tab", { name: "Request" }));
  const request = screen.getByRole("tabpanel");
  expect(request.querySelector(".hljs-string")?.textContent).toBe('"Hi"');
  expect(request.querySelector(".hljs-number")?.textContent).toBe("3");
});

test("a body opens fullscreen in a dialog", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  act(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.test/api/v1/me");
    xhr.send();
  });
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("option", { name: /GET.*\/me/ }));
  await user.click(
    screen.getByRole("button", { name: /View response body .* fullscreen/i }),
  );

  const dialog = screen.getByRole("dialog", {
    name: "Response body · GET /api/v1/me",
  });
  expect(dialog.querySelector(".hljs-attr")?.textContent).toBe('"ok"');
});

test("copy lets you pick url, bodies and headers", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  act(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.test/api/v1/notes");
    xhr.setRequestHeader("X-Trace", "t-1");
    xhr.send('{"text":"hello"}');
  });
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("option", { name: /POST.*notes/ }));
  await user.click(
    screen.getByRole("button", { name: "Copy request for agent" }),
  );

  // Headers start checked (nothing stored yet): untick the bodies.
  await user.click(screen.getByRole("checkbox", { name: "Request body" }));
  await user.click(screen.getByRole("checkbox", { name: "Response body" }));
  await user.click(screen.getByRole("button", { name: "Copy" }));

  const text = await navigator.clipboard.readText();
  expect(text).toContain("## POST /api/v1/notes → 200");
  expect(text).toContain("- **URL:** https://api.test/api/v1/notes");
  expect(text).toContain("- **Viewport:** Full");
  expect(text).toContain("X-Trace: t-1");
  expect(text).not.toContain("Request body");
  expect(text).not.toContain("Response body");
});

test("copy menu copies cURL and fetch, and replay re-sends the request", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  act(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.test/api/v1/ping");
    xhr.send();
  });
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("option", { name: /GET.*ping/ }));

  await user.click(
    screen.getByRole("button", { name: "Copy request for agent" }),
  );
  await user.click(screen.getByRole("button", { name: "Copy as cURL" }));
  expect(await navigator.clipboard.readText()).toBe(
    "curl 'https://api.test/api/v1/ping'",
  );

  await user.click(
    screen.getByRole("button", { name: "Copy request for agent" }),
  );
  await user.click(screen.getByRole("button", { name: "Copy as fetch" }));
  expect(await navigator.clipboard.readText()).toContain(
    'await fetch("https://api.test/api/v1/ping"',
  );

  expect(screen.getAllByRole("option")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Replay request" }));
  expect(screen.getAllByRole("option")).toHaveLength(2);
});

function send(method: string, url: string, status = 200) {
  act(() => {
    const xhr = new XMLHttpRequest() as unknown as FakeXhr & XMLHttpRequest;
    xhr.nextStatus = status;
    xhr.open(method, url);
    xhr.send();
  });
}

test("network quick filters narrow the list by errors and method", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  send("GET", "https://api.test/api/v1/a");
  send("POST", "https://api.test/api/v1/b", 500);
  send("DELETE", "https://api.test/api/v1/c");

  await user.click(screen.getByRole("button", { name: "Network requests" }));
  const rows = () => screen.getAllByRole("option").map((o) => o.textContent);
  expect(rows()).toHaveLength(3);

  await user.click(screen.getByRole("button", { name: /^Errors/ }));
  expect(rows()).toHaveLength(1);
  expect(rows()[0]).toContain("POST");
  await user.click(screen.getByRole("button", { name: /^Errors/ }));

  await user.click(screen.getByRole("button", { name: "GET" }));
  await user.click(screen.getByRole("button", { name: "DELETE" }));
  expect(rows().map((r) => r?.slice(0, 6))).toEqual(
    expect.arrayContaining([expect.stringMatching(/GET|DELETE/)]),
  );
  expect(rows()).toHaveLength(2);
  expect(rows().join(" ")).not.toContain("POST");
});

test("the console panel lists errors and warnings and filters by level", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  await act(async () => {
    console.error("Hydration failed");
    console.warn("Deprecated prop");
  });

  await user.click(
    screen.getByRole("button", { name: "Console errors and warnings" }),
  );
  expect(screen.getAllByRole("option")).toHaveLength(2);

  await user.click(screen.getByRole("button", { name: /^Errors/ }));
  const only = screen.getAllByRole("option");
  expect(only).toHaveLength(1);
  expect(only[0].textContent).toContain("Hydration failed");

  await user.click(only[0]);
  await user.click(screen.getByRole("button", { name: "Copy message for AI" }));
  const text = await navigator.clipboard.readText();
  expect(text).toContain("## console.error");
  expect(text).toContain("Hydration failed");

  await user.click(screen.getByRole("button", { name: "Clear console" }));
  expect(screen.queryAllByRole("option")).toHaveLength(0);
});

test("display options rotate, size, darken and translate the framed page", async () => {
  const user = userEvent.setup();
  const plugins = defaultPlugins().map((p) =>
    p.id === "display"
      ? display({ locale: { cookie: "locale", options: ["en", "th"] } })
      : p,
  );
  render(<DevViewportSwitcher plugins={plugins} />);

  await user.keyboard("3");
  expect(screen.getByTitle("iPad viewport").style.width).toBe("820px");

  await fromMenu(user, "Display");
  await user.click(screen.getByRole("switch", { name: /Rotate/ }));
  expect(screen.getByTitle("iPad viewport").style.width).toBe("1180px");
  expect(screen.getByTitle("iPad viewport").style.height).toBe("820px");

  const width = screen.getByRole("textbox", { name: "Custom width" });
  await user.clear(width);
  await user.type(width, "600");
  await user.tab();
  expect(pressed("Custom")).toBe("true");
  expect(screen.getByTitle("Custom viewport").style.height).toBe("600px");

  await user.click(screen.getByRole("switch", { name: "Dark mode" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await user.click(screen.getByRole("switch", { name: "Dark mode" }));
  expect(document.documentElement.classList.contains("dark")).toBe(false);

  await user.click(screen.getByRole("radio", { name: "th" }));
  expect(document.cookie).toContain("locale=th");
});

test("rotate is unavailable until a device is picked", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await fromMenu(user, "Display");
  expect(
    screen
      .getByRole("switch", { name: /Rotate/ })
      .getAttribute("aria-disabled") ??
      screen.getByRole("switch", { name: /Rotate/ }).getAttribute("disabled"),
  ).not.toBeNull();
});

// jsdom lays nothing out. Give the dock parts a real place in the window so
// the keep-inside-the-window clamp has something to measure.
function placeDock() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const spy = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this.dataset.dock === "chip") {
        return new DOMRect(470, 640, 80, 28);
      }
      if (this.dataset.dock === "toolbar") {
        return new DOMRect(300, 712, 424, 40);
      }
      return original.call(this);
    });
  return () => spy.mockRestore();
}

// The toolbar renders into its own host on <body>, outside RTL's container.
function dockOffset(_container?: HTMLElement) {
  const dock =
    document.querySelector<HTMLElement>("[data-dock='chip']")?.parentElement;
  return {
    x: dock?.style.getPropertyValue("--dock-x"),
    y: dock?.style.getPropertyValue("--dock-y"),
  };
}

test("Alt+arrows on the grip move the dock, double-click puts it back", async () => {
  const user = userEvent.setup();
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  expect(dockOffset(container)).toEqual({ x: "0px", y: "0px" });

  const grip = screen.getByRole("button", { name: "Move dev tools" });
  grip.focus();
  await user.keyboard("{Alt>}{ArrowRight}{ArrowDown}{/Alt}");
  expect(dockOffset(container)).toEqual({ x: "8px", y: "8px" });
  expect(
    JSON.parse(window.localStorage.getItem("devbelt:position")!),
  ).toEqual({
    x: 8,
    y: 8,
  });

  await user.keyboard("{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}");
  expect(dockOffset(container).x).toBe("48px");

  await user.dblClick(grip);
  expect(dockOffset(container)).toEqual({ x: "0px", y: "0px" });
  expect(window.localStorage.getItem("devbelt:position")).toBeNull();
  unplace();
});

test("plain arrows still walk the toolbar and don't move the dock", async () => {
  const user = userEvent.setup();
  const { container } = render(<DevViewportSwitcher />);
  screen.getByRole("button", { name: "Move dev tools" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).not.toBe(
    screen.getByRole("button", { name: "Move dev tools" }),
  );
  expect(dockOffset(container)).toEqual({ x: "0px", y: "0px" });
});

test("dragging the grip moves the dock and remembers where it landed", async () => {
  const user = userEvent.setup();
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  const grip = screen.getByRole("button", { name: "Move dev tools" });

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: grip,
      coords: { clientX: 100, clientY: 100 },
    },
    { coords: { clientX: 140, clientY: 70 } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  await user.pointer({
    keys: "[/MouseLeft]",
    coords: { clientX: 140, clientY: 70 },
  });
  expect(dockOffset(container)).toEqual({ x: "40px", y: "-30px" });
  expect(
    JSON.parse(window.localStorage.getItem("devbelt:position")!),
  ).toEqual({
    x: 40,
    y: -30,
  });
  unplace();
});

test("the dock can't be dragged out of the window", async () => {
  const user = userEvent.setup();
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  const grip = screen.getByRole("button", { name: "Move dev tools" });

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: grip,
      coords: { clientX: 100, clientY: 100 },
    },
    { coords: { clientX: -5000, clientY: -5000 } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  await user.pointer({
    keys: "[/MouseLeft]",
    coords: { clientX: -5000, clientY: -5000 },
  });
  // pinned to the window edge: the magnet settles it at the 16px gap
  expect(dockOffset(container)).toEqual({ x: "-284px", y: "-624px" });
  unplace();
});

test("a saved position is restored on load", () => {
  window.localStorage.setItem(
    "devbelt:position",
    JSON.stringify({ x: 120, y: -60 }),
  );
  const { container } = render(<DevViewportSwitcher />);
  expect(dockOffset(container)).toEqual({ x: "120px", y: "-60px" });
});

test("Escape during a drag puts the dock back", async () => {
  const user = userEvent.setup();
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  const grip = screen.getByRole("button", { name: "Move dev tools" });

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: grip,
      coords: { clientX: 100, clientY: 100 },
    },
    { coords: { clientX: 160, clientY: 60 } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  expect(dockOffset(container)).toEqual({ x: "60px", y: "-40px" });

  await user.keyboard("{Escape}");
  expect(dockOffset(container)).toEqual({ x: "0px", y: "0px" });
  await user.pointer({ keys: "[/MouseLeft]" });
  expect(window.localStorage.getItem("devbelt:position")).toBeNull();
  unplace();
});

async function dragGrip(
  by: { dx: number; dy: number },
  options: { release?: boolean; alt?: boolean } = {},
) {
  const user = userEvent.setup();
  const grip = screen.getByRole("button", { name: "Move dev tools" });
  if (options.alt) await user.keyboard("{Alt>}");
  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: grip,
      coords: { clientX: 100, clientY: 100 },
    },
    { coords: { clientX: 100 + by.dx, clientY: 100 + by.dy } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  const release = async () => {
    await user.pointer({ keys: "[/MouseLeft]" });
    if (options.alt) await user.keyboard("{/Alt}");
  };
  if (options.release !== false) await release();
  return release;
}

test("the dock snaps its centre to the window's centre and shows a guide", async () => {
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);

  // 8px right of home: centre 520 vs window centre 512
  const release = await dragGrip({ dx: 8, dy: 0 }, { release: false });
  expect(dockOffset(container).x).toBe("0px");
  expect(
    container.ownerDocument.querySelector<HTMLElement>("[data-dock-guide='x']")
      ?.style.left,
  ).toBe("512px");
  await release();
  expect(container.ownerDocument.querySelector("[data-dock-guide]")).toBeNull();
  unplace();
});

test("the dock snaps to the window's edges and its bottom rest line", async () => {
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);

  // left edge would land at 24: pulled to 16
  await dragGrip({ dx: -276, dy: 0 });
  expect(dockOffset(container).x).toBe("-284px");
  unplace();
});

test("the bottom edge snaps back to its resting gap", async () => {
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  // 8px up from home: bottom 744 vs rest line 752
  await dragGrip({ dx: 100, dy: -8 });
  expect(dockOffset(container)).toEqual({ x: "100px", y: "0px" });
  unplace();
});

test("far from any line the dock stays where it was dropped", async () => {
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  await dragGrip({ dx: 120, dy: -200 });
  expect(dockOffset(container)).toEqual({ x: "120px", y: "-200px" });
  expect(container.ownerDocument.querySelector("[data-dock-guide]")).toBeNull();
  unplace();
});

test("holding Alt turns the magnet off", async () => {
  const unplace = placeDock();
  const { container } = render(<DevViewportSwitcher />);
  await dragGrip({ dx: 8, dy: -8 }, { alt: true });
  expect(dockOffset(container)).toEqual({ x: "8px", y: "-8px" });
  unplace();
});

test("Copy debug bundle puts page, viewport and problems on the clipboard", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  send("POST", "https://api.test/api/v1/orders", 500);
  await act(async () => {
    console.error("Checkout crashed");
  });

  await user.keyboard("2");
  await fromMenu(user, "Copy debug bundle");
  const text = await navigator.clipboard.readText();
  expect(text).toContain("# Debug context");
  expect(text).toContain("- **Viewport:** Mobile 390×844");
  expect(text).toContain("Checkout crashed");
  expect(text).toContain("### POST /api/v1/orders → 500");
});

test("a pinned debug bundle button confirms the copy", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(
    screen.getByRole("menuitemcheckbox", { name: "Copy debug bundle" }),
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Copy debug bundle" }));
  expect(
    screen.getByRole("button", { name: "Copy debug bundle" }).textContent,
  ).toContain("Copied");
});

test("the tools are callable from window.devbelt", async () => {
  render(<DevViewportSwitcher />);
  send("GET", "https://api.test/api/v1/ok");
  send("POST", "https://api.test/api/v1/bad", 500);

  type Tools = Record<
    string,
    (input?: object) => { content: { text: string }[] }
  >;
  const tools = (window as unknown as { devbelt: Tools }).devbelt;
  expect(Object.keys(tools).sort()).toEqual([
    "devbelt_get_console",
    "devbelt_get_debug_bundle",
    "devbelt_get_network",
    "devbelt_set_viewport",
  ]);

  const failed = tools.devbelt_get_network({ failedOnly: true }).content[0]
    .text;
  expect(failed).toContain("POST /api/v1/bad → 500");
  expect(failed).not.toContain("/api/v1/ok");
  expect(
    tools.devbelt_get_network({ method: "get" }).content[0].text,
  ).toContain("GET /api/v1/ok");
  expect(tools.devbelt_get_console().content[0].text).toBe("Nothing logged.");
  expect(tools.devbelt_get_debug_bundle().content[0].text).toContain(
    "# Debug context",
  );

  act(() => {
    tools.devbelt_set_viewport({ viewport: "ipad" });
  });
  expect(screen.getByTitle("iPad viewport")).toBeTruthy();
  expect(
    tools.devbelt_set_viewport({ viewport: "tv" }).content[0].text,
  ).toContain("Unknown viewport");
});

test("tools are offered to a WebMCP browser and removed on unmount", () => {
  const registerTool = vi.fn();
  const unregisterTool = vi.fn();
  Object.assign(document, { modelContext: { registerTool, unregisterTool } });
  try {
    const { unmount } = render(<DevViewportSwitcher />);
    expect(registerTool.mock.calls.map(([tool]) => tool.name).sort()).toEqual([
      "devbelt_get_console",
      "devbelt_get_debug_bundle",
      "devbelt_get_network",
      "devbelt_set_viewport",
    ]);
    const network = registerTool.mock.calls.find(
      ([tool]) => tool.name === "devbelt_get_network",
    )![0];
    expect(network.annotations).toMatchObject({ readOnlyHint: true });
    unmount();
    expect(unregisterTool).toHaveBeenCalledTimes(4);
  } finally {
    delete (document as unknown as Record<string, unknown>).modelContext;
  }
});

test("Grab appends recent problems unless the setting is off", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  send("POST", "https://api.test/api/v1/pay", 500);

  await user.click(screen.getByRole("button", { name: "Grab element" }));
  expect(grabProps.current?.appendix?.()).toContain("POST /api/v1/pay → 500");
  await user.click(screen.getByRole("button", { name: "Grab element" }));

  await fromMenu(user, "Display");
  await user.click(
    screen.getByRole("switch", { name: /Grab includes errors/ }),
  );
  await user.click(screen.getByRole("button", { name: "Close Display" }));
  await user.click(screen.getByRole("button", { name: "Grab element" }));
  expect(grabProps.current?.appendix).toBeUndefined();
});

test("waterfall bars are placed by CSS variables on the row and the list", async () => {
  const user = userEvent.setup();
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(1_000_000);
  send("GET", "https://api.test/first");
  now.mockReturnValue(1_000_250);
  send("GET", "https://api.test/second");
  now.mockRestore();

  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));

  const list = screen.getByRole("listbox", { name: "Requests" });
  expect(list.style.getPropertyValue("--span")).not.toBe("");
  const tracks = [
    ...list.querySelectorAll<HTMLElement>(
      "[aria-hidden='true'][style*='--start']",
    ),
  ];
  expect(tracks.map((t) => t.style.getPropertyValue("--start"))).toEqual([
    "250",
    "0",
  ]);
  expect(tracks.every((t) => t.style.getPropertyValue("--dur") !== "")).toBe(
    true,
  );
});

const windowEl = (name: string) =>
  screen.getByRole("region", { name }) as HTMLElement;

test("the toolbar shows pinned tools only; the rest are in More tools", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  for (const name of [
    "Grab element",
    "Network requests",
    "Console errors and warnings",
    "More tools",
  ]) {
    expect(screen.getByRole("button", { name })).toBeTruthy();
  }
  expect(screen.queryByRole("button", { name: "Display options" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Copy debug bundle" }),
  ).toBeNull();

  await user.click(screen.getByRole("button", { name: "More tools" }));
  const pinned = [
    "Viewport",
    "Grab element",
    "Network",
    "Console",
    "Copy debug bundle",
    "Display",
  ].map((name) => screen.getByRole("menuitemcheckbox", { name }));
  expect(pinned.map((p) => p.getAttribute("aria-checked"))).toEqual([
    "true",
    "true",
    "true",
    "true",
    "false",
    "false",
  ]);
});

test("pinning a tool puts it on the toolbar and unpinning removes it", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);

  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Display" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Console" }));
  await user.keyboard("{Escape}");

  expect(screen.getByRole("button", { name: "Display options" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Console errors and warnings" }),
  ).toBeNull();
  // only what differs from each plugin's default is saved
  expect(
    JSON.parse(window.localStorage.getItem("devbelt:layout")!).pinned,
  ).toEqual({ display: true, console: false });
});

test("unpinning Viewport hides its buttons but the menu still switches it", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Viewport" }));
  expect(screen.queryByRole("button", { name: "iPad" })).toBeNull();

  await user.click(screen.getByRole("menuitemradio", { name: "iPad" }));
  expect(screen.getByTitle("iPad viewport")).toBeTruthy();
});

test("tools open as floating windows, several at once, in front when clicked", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  send("GET", "https://api.test/api/v1/win");
  await act(async () => {
    console.error("Window error");
  });

  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(
    screen.getByRole("button", { name: "Console errors and warnings" }),
  );
  const network = windowEl("Network");
  const consoleWin = windowEl("Console");
  expect(within(network).getAllByRole("option")).toHaveLength(1);
  expect(within(consoleWin).getAllByRole("option")).toHaveLength(1);

  const z = (el: HTMLElement) => Number(el.style.zIndex);
  expect(z(consoleWin)).toBeGreaterThan(z(network));
  await user.click(
    within(network).getByRole("textbox", { name: "Filter requests" }),
  );
  expect(z(windowEl("Network"))).toBeGreaterThan(z(windowEl("Console")));

  await user.click(screen.getByRole("button", { name: "Close Network" }));
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
  expect(windowEl("Console")).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Network requests" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});

test("the toolbar button toggles its window and Escape closes it", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  const button = screen.getByRole("button", { name: "Network requests" });
  await user.click(button);
  expect(windowEl("Network")).toBeTruthy();
  expect(button.getAttribute("aria-pressed")).toBe("true");

  await user.click(
    within(windowEl("Network")).getByRole("textbox", {
      name: "Filter requests",
    }),
  );
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();

  await user.click(button);
  await user.click(button);
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
});

test("a window is dragged by its header and keeps where it was left", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  const win = windowEl("Network");
  const x0 = parseFloat(win.style.getPropertyValue("--x"));
  const y0 = parseFloat(win.style.getPropertyValue("--y"));
  const header = win.querySelector("header") as HTMLElement;

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: header,
      coords: { clientX: 300, clientY: 200 },
    },
    { coords: { clientX: 360, clientY: 230 } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  await user.pointer({
    keys: "[/MouseLeft]",
    coords: { clientX: 360, clientY: 230 },
  });

  const moved = windowEl("Network");
  expect(parseFloat(moved.style.getPropertyValue("--x"))).toBe(x0 + 60);
  expect(parseFloat(moved.style.getPropertyValue("--y"))).toBe(y0 + 30);
  const saved = JSON.parse(window.localStorage.getItem("devbelt:layout")!).rects
    .network;
  expect(saved).toMatchObject({ x: x0 + 60, y: y0 + 30 });
});

test("a window is resized from its corner, but not below its minimum", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  const win = windowEl("Network");
  const w0 = parseFloat(win.style.getPropertyValue("--w"));
  const corner = win.querySelector(".cursor-nwse-resize") as HTMLElement;

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: corner,
      coords: { clientX: 500, clientY: 400 },
    },
    { coords: { clientX: 540, clientY: 440 } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  await user.pointer({
    keys: "[/MouseLeft]",
    coords: { clientX: 540, clientY: 440 },
  });
  expect(parseFloat(windowEl("Network").style.getPropertyValue("--w"))).toBe(
    w0 + 40,
  );

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: corner,
      coords: { clientX: 500, clientY: 400 },
    },
    { coords: { clientX: -5000, clientY: -5000 } },
  ]);
  await act(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
  await user.pointer({
    keys: "[/MouseLeft]",
    coords: { clientX: -5000, clientY: -5000 },
  });
  expect(parseFloat(windowEl("Network").style.getPropertyValue("--w"))).toBe(
    460,
  );
  expect(parseFloat(windowEl("Network").style.getPropertyValue("--h"))).toBe(
    240,
  );
});

test("Alt+arrows on a window's grip move it and Ctrl resizes it", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(
    screen.getByRole("button", { name: "Console errors and warnings" }),
  );
  const win = windowEl("Console");
  const x0 = parseFloat(win.style.getPropertyValue("--x"));
  const w0 = parseFloat(win.style.getPropertyValue("--w"));

  screen.getByRole("button", { name: "Move Console" }).focus();
  await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
  expect(parseFloat(windowEl("Console").style.getPropertyValue("--x"))).toBe(
    x0 + 8,
  );
  await user.keyboard("{Alt>}{Control>}{ArrowRight}{/Control}{/Alt}");
  expect(parseFloat(windowEl("Console").style.getPropertyValue("--w"))).toBe(
    w0 + 8,
  );
});

test("open windows come back after a reload, and Reset layout clears them", async () => {
  const user = userEvent.setup();
  const first = render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(
    screen.getByRole("button", { name: "Console errors and warnings" }),
  );
  first.unmount();

  render(<DevViewportSwitcher />);
  expect(windowEl("Network")).toBeTruthy();
  expect(windowEl("Console")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitem", { name: "Reset layout" }));
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Console" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Display options" })).toBeNull();
});

test("a window that was saved off screen is pulled back into view", () => {
  window.localStorage.setItem(
    "devbelt:layout",
    JSON.stringify({
      pinned: ["viewport", "network"],
      open: ["network"],
      rects: { network: { x: 99999, y: -500, width: 100, height: 50 } },
    }),
  );
  render(<DevViewportSwitcher />);
  const win = windowEl("Network");
  const num = (name: string) => parseFloat(win.style.getPropertyValue(name));
  expect(num("--x")).toBeLessThanOrEqual(window.innerWidth - 96);
  expect(num("--y")).toBeGreaterThanOrEqual(0);
  expect(num("--w")).toBeGreaterThanOrEqual(460);
  expect(num("--h")).toBeGreaterThanOrEqual(240);
});

test("Esc closes the front window from anywhere, one window per press", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(
    screen.getByRole("button", { name: "Console errors and warnings" }),
  );

  // focus is on the toolbar button, outside both windows
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Console" })).toBeNull();
  expect(windowEl("Network")).toBeTruthy();

  (document.activeElement as HTMLElement | null)?.blur();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();

  // nothing open: Esc is left for the page
  await user.keyboard("{Escape}");
});

test("Esc closes whichever window was clicked last, not the one opened last", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(
    screen.getByRole("button", { name: "Console errors and warnings" }),
  );
  await user.click(
    within(windowEl("Network")).getByRole("textbox", {
      name: "Filter requests",
    }),
  );

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
  expect(windowEl("Console")).toBeTruthy();
});

test("Esc doesn't close a window while Grab is picking", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("button", { name: "Grab element" }));

  await user.keyboard("{Escape}");
  expect(windowEl("Network")).toBeTruthy();

  // the mocked picker never ends Grab, so switch it off the way a person would
  await user.click(screen.getByRole("button", { name: "Grab element" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
});

test("Esc closes an open menu first and leaves the window for the next press", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("button", { name: "More tools" }));
  expect(screen.getByRole("menuitem", { name: "Display" })).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menuitem", { name: "Display" })).toBeNull();
  expect(windowEl("Network")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
});

test("Esc closes the copy popover inside a window before the window", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  send("GET", "https://api.test/api/v1/esc");
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("option", { name: /GET.*esc/ }));
  await user.click(
    screen.getByRole("button", { name: "Copy request for agent" }),
  );
  expect(screen.getByRole("checkbox", { name: "URL" })).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("checkbox", { name: "URL" })).toBeNull();
  expect(windowEl("Network")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
});

test("G turns Grab on and off, and the tooltip shows the key", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  const grab = screen.getByRole("button", { name: "Grab element" });
  expect(grab.getAttribute("aria-pressed")).toBe("false");

  await user.keyboard("g");
  expect(grab.getAttribute("aria-pressed")).toBe("true");
  await user.keyboard("g");
  expect(grab.getAttribute("aria-pressed")).toBe("false");

  expect(grab.getAttribute("aria-keyshortcuts")?.toLowerCase()).toBe("g");
  // the tooltip is in the page from the start, so it can name the button
  expect(document.body.textContent).toContain(
    "Click to copy · drag for a region · ⌘/Ctrl+click for several",
  );
});

test("G doesn't turn Grab on while someone is typing", async () => {
  const user = userEvent.setup();
  render(<DevViewportSwitcher />);
  await user.click(screen.getByRole("button", { name: "Network requests" }));
  await user.click(screen.getByRole("textbox", { name: "Filter requests" }));
  await user.keyboard("get");
  expect(
    screen
      .getByRole("button", { name: "Grab element" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
  expect(
    (
      screen.getByRole("textbox", {
        name: "Filter requests",
      }) as HTMLInputElement
    ).value,
  ).toBe("get");
});
