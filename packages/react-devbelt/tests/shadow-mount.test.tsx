// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { definePlugin } from "../src/plugin";
import ToolbarImpl from "../src/ui/toolbar";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const boom = definePlugin({
  id: "boom",
  name: "Boom",
  icon: null,
  Item() {
    throw new Error("render failed");
  },
});
const fine = definePlugin({
  id: "fine",
  name: "Fine",
  icon: null,
  styles: ".plugin-css{color:red}",
  Item: () => <span data-testid="fine">fine</span>,
});

test("shadow isolation puts the toolbar in a shadow root with the plugin's css, and removes it on unmount", () => {
  const { unmount } = render(<ToolbarImpl plugins={[fine]} isolation="shadow" />);
  const host = document.querySelector("devbelt-root") as HTMLElement;
  expect(host).toBeTruthy();
  expect(host.hasAttribute("data-react-grab-ignore")).toBe(true);
  const shadow = host.shadowRoot!;
  expect(shadow.querySelector("[data-testid=fine]")).toBeTruthy();
  expect(shadow.querySelector("style")!.textContent).toContain(".plugin-css");
  // nothing of the toolbar is reachable from the page's own DOM queries
  expect(document.body.querySelector("[data-testid=fine]")).toBeNull();
  expect(document.getElementById("devbelt-properties")).toBeTruthy();

  unmount();
  expect(document.querySelector("devbelt-root")).toBeNull();
});

test("a plugin whose item throws loses only its own item", () => {
  const warn = console.warn;
  console.warn = () => {};
  const error = console.error;
  console.error = () => {};
  try {
    render(<ToolbarImpl plugins={[boom, fine]} isolation="shadow" />);
    const shadow = document.querySelector("devbelt-root")!.shadowRoot!;
    expect(shadow.querySelector("[data-testid=fine]")).toBeTruthy();
    expect(shadow.querySelector("[data-dock=toolbar]")).toBeTruthy();
  } finally {
    console.warn = warn;
    console.error = error;
  }
});
