/** Breakpoint name to its minimum width: px as a number, or a `rem`/`px` string. */
export type Breakpoints = Record<string, number | string>;

/** Tailwind v4's defaults. */
export const DEFAULT_BREAKPOINTS: Breakpoints = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
};

/** The name used below the smallest breakpoint (Tailwind's unprefixed styles). */
export const BASE_BREAKPOINT = "base";

const REM_PX = 16;

function toPx(value: number | string): number {
  if (typeof value === "number") return value;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return Number.POSITIVE_INFINITY;
  return value.trim().endsWith("rem") ? n * REM_PX : n;
}

/** The widest breakpoint whose minimum is at or below `width`. */
export function resolveBreakpoint(
  width: number,
  breakpoints: Breakpoints = DEFAULT_BREAKPOINTS,
): string {
  let name = BASE_BREAKPOINT;
  let best = -1;
  for (const [key, value] of Object.entries(breakpoints)) {
    const min = toPx(value);
    if (min <= width && min > best) {
      name = key;
      best = min;
    }
  }
  return name;
}
