# 005 — Measure the viewport pill's `width` animation; change only if it janks

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 0–1 file; start with a measurement

## Problem

The sliding pill under the viewport presets animates `x` (accelerated on `motion` 14.14) and `width` (a layout property, main thread):

```tsx
// packages/react-devbelt/src/plugins/viewport/index.tsx:116-122 — current
<motion.span
  aria-hidden="true"
  initial={false}
  animate={{ x: indicator.box.left, width: indicator.box.width }}
  transition={indicator.animate ? transition : { duration: 0 }}
  className="pointer-events-none absolute inset-y-0 start-0 rounded-full bg-inverse shadow-sm"
/>
```

The element is tiny and its subtree is empty, so the layout cost is probably negligible. `scaleX` would be fully compositor-friendly but distorts the `rounded-full` ends and the shadow during the move, which is worse to look at. So this plan is measure-first.

## Target

One of two outcomes, chosen by the measurement:

1. **No change** (expected): the width animation costs under ~0.5 ms/frame and doesn't drop frames. Record the numbers in the plan's Status line and mark it `WONTFIX`.
2. **If it janks** (frames over 16 ms during the pill move on a busy host page): replace the width tween with a pill that is the width of the *widest* preset and clip it, i.e. animate `clipPath: "inset(0 <right>px 0 <left>px round 9999px)"` where `<left>`/`<right>` come from `indicator.box`. `clip-path` is a documented exception to the "transform and opacity only" rule. The `shadow-sm` must then move to a wrapper, because clip-path would clip it.

## Repo conventions to follow

- Spring: `useToolbarTransition()` (`packages/react-devbelt/src/ui/motion.ts`); keep it.
- The first paint must stay `{ duration: 0 }` (`indicator.animate` is false until the first box exists, lines ~95-101).

## Steps

1. Run an example app with a heavy page (or throttle CPU 6x in DevTools Performance). Record 5 s while switching presets 10 times by clicking.
2. In the Performance panel, inspect the frames during pill moves. Note: longest frame, and total "Layout" time in the window.
3. If every frame stays under 16 ms with CPU 6x throttle: write the result under Status, set it to `WONTFIX`, and stop. Do not edit source.
4. Otherwise implement outcome 2 and re-measure.

## Boundaries

- Do NOT use `scaleX` on the pill.
- Do NOT change the other `motion` usage in this file.
- Do NOT add dependencies.

## Verification

- **Mechanical** (only if code changed): `pnpm typecheck && pnpm test && pnpm lint`.
- **Feel check** (only if code changed): at 10% playback the pill keeps fully round ends while crossing between presets; hover and focus rings are not clipped.
- **Done when**: Status holds measured numbers and a decision (`WONTFIX` or `DONE`).
