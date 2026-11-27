import { useReducedMotion, type Transition } from "motion/react";

/**
 * Fling from easing.dev, played about twice as fast. Mass and damping are
 * scaled together so the overshoot stays the same and it settles in about a
 * quarter of a second.
 */
export const toolbarSpring: Transition = {
  type: "spring",
  mass: 1,
  stiffness: 800,
  damping: 40,
};

/** The spring, or no motion when the visitor prefers reduced motion. */
export function useToolbarTransition(): Transition {
  const reduce = useReducedMotion();
  return reduce ? { duration: 0 } : toolbarSpring;
}
