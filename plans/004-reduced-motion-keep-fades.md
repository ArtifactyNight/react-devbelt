# 004 — Keep opacity fades under reduced motion

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: LOW
- **Category**: Accessibility
- **Estimated scope**: 1 file, ~6 lines

## Problem

Under `prefers-reduced-motion`, the shared hook returns `{ duration: 0 }` for every property. That removes the movement (good) but also the opacity fades that tell people a HUD or chip status has appeared or left. Reduced motion should mean fewer and gentler animations, not none.

```ts
// packages/react-devbelt/src/ui/motion.ts:15-19 — current
/** The spring, or no motion when the visitor prefers reduced motion. */
export function useToolbarTransition(): Transition {
  const reduce = useReducedMotion();
  return reduce ? { duration: 0 } : toolbarSpring;
}
```

Callers that mix opacity with movement: the viewport HUD (`packages/react-devbelt/src/plugins/viewport/index.tsx:201-208`, `opacity` + `scale`) and the collapsed-chip status (`packages/react-devbelt/src/ui/toolbar.tsx:259-262`, `opacity` + `y`).

## Target

Under reduced motion, transform-type properties snap and `opacity` fades over 150ms with a strong ease-out. Motion's `Transition` supports per-property overrides, so no caller changes are needed.

```ts
// target
const reducedTransition: Transition = {
  default: { duration: 0 },
  opacity: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
};

/** The spring; under reduced motion, movement snaps and only opacity fades. */
export function useToolbarTransition(): Transition {
  const reduce = useReducedMotion();
  return reduce ? reducedTransition : toolbarSpring;
}
```

## Repo conventions to follow

- Keep `toolbarSpring` unchanged and keep the hook name and signature, since 4 call sites use it (`grep -rn useToolbarTransition packages/react-devbelt/src`).
- Define the constant at module level, next to `toolbarSpring`, so it isn't re-created per render.

## Steps

1. In `packages/react-devbelt/src/ui/motion.ts`, add `reducedTransition` above the hook exactly as in the target.
2. Replace the hook body and its doc comment as in the target.
3. Do not touch the literal `{ duration: 0 }` in `packages/react-devbelt/src/plugins/viewport/index.tsx:120` (the pill's first paint); that one is intentional.

## Boundaries

- Do NOT edit the callers.
- Do NOT change the spring values.
- Do NOT add dependencies.
- If the TypeScript types reject the per-property object, STOP and report the error rather than casting.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm test && pnpm lint` pass.
- **Feel check**: DevTools, Rendering panel, set "Emulate CSS prefers-reduced-motion: reduce", then:
  - change viewport preset with the keyboard: the HUD fades in/out, with no scale;
  - collapse the toolbar: the chip's status icons fade in, with no 4px rise; the chevron and toolbar position snap;
  - switch emulation off: the springs behave exactly as before.
- **Done when**: with reduction on, nothing translates, scales or rotates, but fades remain.
