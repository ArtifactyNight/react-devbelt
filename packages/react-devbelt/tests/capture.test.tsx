// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { capture } from "../src/plugins";
import { resetViewportStore } from "../src/plugins/viewport/store";
import ToolbarImpl from "../src/ui/toolbar";

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
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
);
Element.prototype.setPointerCapture = function () {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// The renderer itself is modern-screenshot's; what matters here is what we ask of it.
const domToBlob = vi.fn(async () => new Blob(["png"], { type: "image/png" }));
vi.mock("modern-screenshot", () => ({
  domToBlob: (...args: unknown[]) => (domToBlob as (...a: unknown[]) => unknown)(...args),
}));

const downloads: { href: string; name: string }[] = [];
const written: Blob[] = [];
const clipboardWrite = vi.fn();

beforeEach(() => {
  downloads.length = 0;
  written.length = 0;
  domToBlob.mockClear();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ href: this.href, name: this.download });
  });
  URL.createObjectURL = () => "blob:devbelt-test";
  URL.revokeObjectURL = () => {};
  clipboardWrite.mockReset();
  clipboardWrite.mockImplementation(async (items: { items: Record<string, Blob> }[]) => {
    written.push(...Object.values(items[0].items));
  });
  globalThis.ClipboardItem = class {
    constructor(public items: Record<string, Blob>) {}
  } as unknown as typeof ClipboardItem;

});

afterEach(() => {
  cleanup();
  resetViewportStore();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "mediaDevices");
  Reflect.deleteProperty(globalThis, "MediaRecorder");
});

const plugins = [capture()];
// userEvent.setup() puts its own clipboard stub on navigator, so ours goes on after it
const renderToolbar = () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write: clipboardWrite },
  });
  return render(<ToolbarImpl plugins={plugins} isolation="none" />);
};

test("the camera copies a screenshot of the page and says so", async () => {
  const user = userEvent.setup();
  renderToolbar();

  await user.click(screen.getByRole("button", { name: "Take screenshot" }));

  expect(await screen.findByText("Screenshot copied")).toBeTruthy();
  expect(written).toHaveLength(1);
  expect(written[0].type).toBe("image/png");
  expect(downloads).toHaveLength(0);

  // the toolbar itself is left out of the picture
  const [node, options] = domToBlob.mock.calls[0] as unknown as [
    Element,
    { filter: (n: Node) => boolean; type: string },
  ];
  expect(node).toBe(document.documentElement);
  expect(options.type).toBe("image/png");
  const ours = document.createElement("div");
  ours.setAttribute("data-react-grab-ignore", "");
  expect(options.filter(ours)).toBe(false);
  expect(options.filter(document.createElement("devbelt-root"))).toBe(false);
  expect(options.filter(document.createElement("main"))).toBe(true);
  expect(options.filter(document.createTextNode("text"))).toBe(true);
});

test("when the clipboard says no, the screenshot is saved as a file instead", async () => {
  const user = userEvent.setup();
  renderToolbar();
  clipboardWrite.mockRejectedValueOnce(new Error("denied"));

  await user.click(screen.getByRole("button", { name: "Take screenshot" }));

  expect(await screen.findByText("Clipboard blocked · screenshot saved")).toBeTruthy();
  expect(downloads).toHaveLength(1);
  expect(downloads[0].name).toMatch(/^devbelt-screenshot-page-\d{8}-\d{6}\.png$/);
});

test("More tools saves a screenshot, and a full-page one covers the whole page", async () => {
  const user = userEvent.setup();
  renderToolbar();
  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitem", { name: "Save full-page screenshot" }));

  expect(await screen.findByText("Screenshot saved")).toBeTruthy();
  expect(downloads[0].name).toMatch(/^devbelt-full-page-page-\d{8}-\d{6}\.png$/);
  const [, options] = domToBlob.mock.calls[0] as unknown as [Element, Record<string, unknown>];
  // no cropping to the window: the page's own size
  expect(options.style).toBeUndefined();
});

const overlay = () => document.querySelector("[data-capture-region]") as HTMLElement | null;

async function drag(
  user: ReturnType<typeof userEvent.setup>,
  from: [number, number],
  to: [number, number],
) {
  const target = overlay()!;
  await user.pointer([
    { keys: "[MouseLeft>]", target, coords: { clientX: from[0], clientY: from[1] } },
    { coords: { clientX: to[0], clientY: to[1] } },
    { keys: "[/MouseLeft]", target, coords: { clientX: to[0], clientY: to[1] } },
  ]);
}

test("dragging a region copies a screenshot of just that part", async () => {
  const user = userEvent.setup();
  renderToolbar();
  expect(overlay()).toBeNull();

  await user.click(screen.getByRole("button", { name: "Screenshot a region" }));
  expect(overlay()).not.toBeNull();
  await drag(user, [100, 50], [300, 200]);

  expect(await screen.findByText("Screenshot copied")).toBeTruthy();
  expect(overlay()).toBeNull();
  expect(written).toHaveLength(1);
  const [node, options] = domToBlob.mock.calls[0] as unknown as [
    Element,
    { width: number; height: number; style: { transform: string; transformOrigin: string } },
  ];
  expect(node).toBe(document.documentElement);
  expect([options.width, options.height]).toEqual([200, 150]);
  // the page slides so the region's corner is the image's corner
  expect(options.style.transform).toBe("translate(-100px, -50px)");
  expect(options.style.transformOrigin).toBe("0 0");
});

test("a region can be dragged in any direction", async () => {
  const user = userEvent.setup();
  renderToolbar();
  await user.click(screen.getByRole("button", { name: "Screenshot a region" }));
  await drag(user, [300, 200], [100, 50]);

  await screen.findByText("Screenshot copied");
  const [, options] = domToBlob.mock.calls[0] as unknown as [
    Element,
    { width: number; height: number; style: { transform: string } },
  ];
  expect([options.width, options.height]).toEqual([200, 150]);
  expect(options.style.transform).toBe("translate(-100px, -50px)");
});

test("Escape or a tiny drag leaves the region picker without a screenshot", async () => {
  const user = userEvent.setup();
  renderToolbar();

  await user.click(screen.getByRole("button", { name: "Screenshot a region" }));
  await user.keyboard("{Escape}");
  expect(overlay()).toBeNull();

  await user.click(screen.getByRole("button", { name: "Screenshot a region" }));
  await drag(user, [100, 100], [103, 102]);
  expect(overlay()).toBeNull();

  // the button toggles it too
  await user.click(screen.getByRole("button", { name: "Screenshot a region" }));
  expect(overlay()).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "Screenshot a region" }));
  expect(overlay()).toBeNull();

  expect(domToBlob).not.toHaveBeenCalled();
  expect(written).toHaveLength(0);
});

test("More tools starts the region picker too", async () => {
  const user = userEvent.setup();
  renderToolbar();
  await user.click(screen.getByRole("button", { name: "More tools" }));
  await user.click(screen.getByRole("menuitem", { name: "Screenshot a region" }));
  expect(overlay()).not.toBeNull();
});

test("a screenshot that cannot be made says so", async () => {
  const user = userEvent.setup();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  domToBlob.mockRejectedValueOnce(new Error("tainted canvas"));
  renderToolbar();

  await user.click(screen.getByRole("button", { name: "Take screenshot" }));

  expect(await screen.findByText("Screenshot failed")).toBeTruthy();
  expect(written).toHaveLength(0);
});

class FakeRecorder {
  static isTypeSupported = (type: string) => type === "video/webm;codecs=vp9";
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    public stream: unknown,
    options?: { mimeType?: string },
  ) {
    this.mimeType = options?.mimeType ?? "";
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["video"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function fakeScreenShare() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() });
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  const getDisplayMedia = vi.fn(async () => stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getDisplayMedia },
  });
  globalThis.MediaRecorder = FakeRecorder as unknown as typeof MediaRecorder;
  return { track, getDisplayMedia };
}

test("the circle records the screen and saves a video when stopped", async () => {
  const user = userEvent.setup();
  const { track, getDisplayMedia } = fakeScreenShare();
  renderToolbar();

  await user.click(screen.getByRole("button", { name: "Record screen" }));
  const stop = await screen.findByRole("button", { name: "Stop recording" });
  expect(stop.getAttribute("aria-pressed")).toBe("true");
  expect(getDisplayMedia).toHaveBeenCalledTimes(1);

  await user.click(stop);

  expect(await screen.findByText("Recording saved")).toBeTruthy();
  expect(track.stop).toHaveBeenCalled();
  expect(downloads).toHaveLength(1);
  expect(downloads[0].name).toMatch(/^devbelt-recording-page-\d{8}-\d{6}\.webm$/);
  expect(screen.getByRole("button", { name: "Record screen" })).toBeTruthy();
});

test("stopping the share from the browser ends the recording too", async () => {
  const user = userEvent.setup();
  const { track } = fakeScreenShare();
  renderToolbar();

  await user.click(screen.getByRole("button", { name: "Record screen" }));
  await screen.findByRole("button", { name: "Stop recording" });
  act(() => {
    track.dispatchEvent(new Event("ended"));
  });

  expect(await screen.findByText("Recording saved")).toBeTruthy();
  expect(downloads).toHaveLength(1);
});

test("closing the browser's share prompt cancels without a recording", async () => {
  const user = userEvent.setup();
  fakeScreenShare();
  (navigator.mediaDevices.getDisplayMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new DOMException("dismissed", "NotAllowedError"),
  );
  renderToolbar();

  await user.click(screen.getByRole("button", { name: "Record screen" }));

  expect(await screen.findByText("Recording cancelled")).toBeTruthy();
  expect(downloads).toHaveLength(0);
});

test("without screen capture in the browser there is no record button", () => {
  renderToolbar();
  expect(screen.getByRole("button", { name: "Take screenshot" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Record screen" })).toBeNull();
});
