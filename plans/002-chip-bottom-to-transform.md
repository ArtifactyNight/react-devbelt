# 002 — Animate the collapse chip with `y`, not `bottom`

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, 2 lines

## Problem

The "Show/Hide dev tools" chip animates `bottom` with a spring. `bottom` is a layout property, so each spring frame runs layout on the main thread. The toolbar below it already animates with `y` (transform).

```tsx
// packages/react-devbelt/src/ui/toolbar.tsx:235-242 — current
<motion.div
  data-react-grab-ignore
  data-dock="chip"
  initial={false}
  animate={{ bottom: collapsed ? "1rem" : "4.25rem" }}
  transition={transition}
  className="pointer-events-none fixed inset-x-0 z-[10000] mx-auto flex w-fit"
>
```

Resting positions: collapsed = 1rem from the bottom, expanded = 4.25rem from the bottom (a 3.25rem difference).

## Target

Rest the chip at `bottom-4` (1rem) and lift it with `y` when expanded. Same positions, same spring, no layout.

```tsx
// target
<motion.div
  data-react-grab-ignore
  data-dock="chip"
  initial={false}
  animate={{ y: collapsed ? 0 : "-3.25rem" }}
  transition={transition}
  className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] mx-auto flex w-fit"
>
```

## Repo conventions to follow

- Exemplar, same file, line 281: `animate={{ y: collapsed ? "calc(100% + 1rem)" : 0 }}` on the toolbar wrapper, which already uses string units with `y`.
- The spring comes from `useToolbarTransition()` (`packages/react-devbelt/src/ui/motion.ts`); do not change it here.

## Steps

1. In `toolbar.tsx:239`, replace `animate={{ bottom: collapsed ? "1rem" : "4.25rem" }}` with `animate={{ y: collapsed ? 0 : "-3.25rem" }}`.
2. In the `className` on line 241, add `bottom-4` (e.g. `fixed inset-x-0 bottom-4 z-[10000] ...`).
3. Check `data-dock="chip"` isn't targeted by CSS or JS that reads `bottom`: `grep -rn "dock=\"chip\"\|dock='chip'\|data-dock" packages/react-devbelt/src`. If something reads `style.bottom` or computed `bottom`, STOP and report.

## Boundaries

- Do NOT touch the toolbar wrapper at line 277 or the chip's inner `motion.span` elements.
- Do NOT change the spring or add a transition.
- Do NOT add dependencies.
- If the code differs from the excerpt, STOP and report.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm test && pnpm lint` pass.
- **Feel check**: in an example app, click the chip repeatedly:
  - the chip sits at the same height as before in both states (1rem collapsed, 4.25rem expanded), and the toolbar slides in step with it;
  - spamming the click retargets from the current position without a jump;
  - dragging the dock (the grip) still moves chip and toolbar together;
  - set DevTools Animations playback to 10%: chip and toolbar move as one with no gap opening.
- **Done when**: no `bottom` key remains in a `motion` `animate` prop in `toolbar.tsx`, and the checks above hold.
