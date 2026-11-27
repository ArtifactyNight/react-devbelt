"use client";

import { useEffect } from "react";
import { SlidersHorizontalIcon } from "lucide-react";

import { definePlugin } from "../../plugin";
import {
  getFrameDocument,
  getFrameWindow,
  getViewportState,
  presetOf,
  useViewportState,
} from "../viewport/store";
import {
  DisplayPanel,
  readLocale,
  writeLocale,
  type LocaleOptions,
} from "./panel";

export type DisplayOptions = {
  /**
   * The class that turns dark mode on, set on `<html>` of the page and of the
   * framed page. Default `"dark"`. Pass `false` if the app has no such switch;
   * the Dark mode toggle is then hidden.
   */
  darkClass?: string | false;
  /** Show a language switch that sets a cookie and reloads. Off by default. */
  locale?: LocaleOptions;
};

/** Applies dark mode to the page and to the viewport frame. Renders nothing. */
function makeDarkEffect(darkClass: string | false) {
  return function DarkModeEffect() {
    const { display, active, src, frameVersion } = useViewportState();
    useEffect(() => {
      if (!darkClass || !display.dark) return;
      const docs = () =>
        [document, getFrameDocument()].filter((doc): doc is Document =>
          Boolean(doc),
        );
      docs().forEach((doc) => doc.documentElement?.classList.add(darkClass));
      return () =>
        docs().forEach((doc) =>
          doc.documentElement?.classList.remove(darkClass),
        );
    }, [display.dark, active, src, frameVersion]);
    return null;
  };
}

/** Rotate, custom size, dark mode and (optionally) language. */
export function display(options: DisplayOptions = {}) {
  const darkClass = options.darkClass ?? "dark";
  const locale = options.locale;

  // The locale is a cookie the server reads, so the page has to reload.
  const changeLocale = (value: string) => {
    if (!locale) return;
    writeLocale(locale, value);
    const frame = getFrameWindow();
    if (frame && presetOf(getViewportState())) frame.location.reload();
    else window.location.reload();
  };

  return definePlugin({
    id: "display",
    name: "Display",
    label: "Display options",
    pinned: false,
    icon: <SlidersHorizontalIcon className="size-4" aria-hidden="true" />,
    Overlay: makeDarkEffect(darkClass),
    window: {
      title: "Display",
      size: { width: 340, height: 430, minWidth: 300, minHeight: 300 },
      Component: () => (
        <DisplayPanel
          locale={locale}
          darkClass={darkClass}
          onLocale={changeLocale}
        />
      ),
    },
    debugContext() {
      const settings = getViewportState().display;
      return [
        ...(locale ? [{ label: "Language", value: readLocale(locale) }] : []),
        ...(darkClass
          ? [{ label: "Theme", value: settings.dark ? "dark" : "light" }]
          : []),
      ];
    },
  });
}
