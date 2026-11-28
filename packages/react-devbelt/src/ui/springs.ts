// Motion tokens, from Fluid Functionalism (https://www.fluidfunctionalism.com), the
// `springs` item of its registry. Each tier's value is the ENTER transition, a critically
// damped spring (the largest tier keeps a little bounce). Its `.exit` is the matching EXIT
// transition: a plain tween, no bounce, one tier quicker, so a dismissal reads crisp and final
// instead of replaying the entrance in reverse.
//
//   transition={spring.fast}                              // enter
//   exit={{ opacity: 0, transition: spring.fast.exit }}   // leave
//   transition={open ? spring.slow : spring.slow.exit}    // a target that flips, no unmount
//
// The bigger the thing that moves, the slower the spring. Never hand-write a duration.
//
//   fast      hover, focus, fades, small indicators
//   moderate  short travel: pills, switch thumbs, the chip
//   slow      large surfaces: the toolbar, the size HUD
export const spring = {
  fast: {
    type: "spring" as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  moderate: {
    type: "spring" as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  slow: {
    type: "spring" as const,
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
} as const;
