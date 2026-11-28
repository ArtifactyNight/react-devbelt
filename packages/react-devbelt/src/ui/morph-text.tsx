"use client";

import { useContext, useEffect, type ComponentProps } from "react";
import { TextMorph } from "torph/react";

import { ToolbarContext } from "./context";

type Props = Omit<ComponentProps<typeof TextMorph>, "children"> & {
  children: string | number;
};

// Ease-out, like the rest of the toolbar's motion.
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Torph adds its stylesheet to the page's <head>, which a shadow root does not
 * see: without it the screen-reader copy of the text shows next to the animated
 * one. Copy it into the root the toolbar lives in. It is added when Torph first
 * mounts, which is before this effect: effects run child first.
 */
function useTorphStyles() {
  const root = useContext(ToolbarContext)?.root;
  useEffect(() => {
    if (!root || root === document || root.querySelector("style[data-torph]")) return;
    const source = document.head.querySelector("style[data-torph]");
    if (source) root.append(source.cloneNode(true));
  }, [root]);
}

/**
 * Text that morphs into its next value instead of jumping, with
 * [Torph](https://torph.lochie.me). Use it for text that changes while it is on
 * screen: counts, sizes, a status line. Skips the motion when the person prefers
 * reduced motion. Pass `className` to style it, like a `<span>`.
 */
export function MorphText({ children, duration = 300, ease = EASE, ...rest }: Props) {
  useTorphStyles();
  return (
    <TextMorph duration={duration} ease={ease} {...rest}>
      {String(children)}
    </TextMorph>
  );
}
