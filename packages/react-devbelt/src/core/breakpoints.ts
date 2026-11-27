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

const LENGTH = /^\s*(\d+(?:\.\d+)?)\s*(px|rem)?\s*$/;

/** A width in pixels (rem is 16px), or null when it is not a positive length. */
export function parseBreakpointWidth(value: number | string): number | null {
  let px: number;
  if (typeof value === "number") px = value;
  else {
    const match = LENGTH.exec(value);
    if (!match) return null;
    px = Number.parseFloat(match[1]) * (match[2] === "rem" ? REM_PX : 1);
  }
  return Number.isFinite(px) && px > 0 ? px : null;
}

/** Throws, naming the offending entry, unless every width is a positive length and every name is unique. */
export function validateBreakpoints(breakpoints: Breakpoints, base: string = BASE_BREAKPOINT): void {
  const seen = new Set<string>([base.trim()]);
  for (const [name, value] of Object.entries(breakpoints)) {
    if (parseBreakpointWidth(value) === null) {
      throw new Error(
        `devbelt: breakpoint "${name}" has width ${JSON.stringify(value)}; use a positive number of pixels or a string like "40rem" or "640px".`,
      );
    }
    const key = name.trim();
    if (seen.has(key)) {
      throw new Error(`devbelt: breakpoint name "${name}" is used twice (or is the base range's name "${base}").`);
    }
    seen.add(key);
  }
}

const toPx = (value: number | string): number => parseBreakpointWidth(value) ?? Number.POSITIVE_INFINITY;

/** The widest breakpoint whose minimum is at or below `width`. */
export function resolveBreakpoint(
  width: number,
  breakpoints: Breakpoints = DEFAULT_BREAKPOINTS,
  base: string = BASE_BREAKPOINT,
): string {
  let name = base;
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
