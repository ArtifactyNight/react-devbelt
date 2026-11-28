# 008 — Give floating windows a short enter transition

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: LOW (additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, 1 line
- **Depends on**: 007 (`ease-out` token), 001 (`translate` positioning)

## Problem

Plugin windows appear with no motion, while the Network fullscreen dialog fades and scales in. The toolbar click that opens a window gives no spatial hint of where it came from, and the two window types feel unrelated.

```tsx
// packages/react-devbelt/src/ui/floating-window.tsx:145 — current (after plan 001 it contains `top-0 left-0 [translate:var(--x)_var(--y)]`)
className="pointer-events-auto fixed top-(--y) left-(--x) flex h-(--h) w-(--w) flex-col overflow-hidden rounded-xl border border-line bg-surface text-xs text-fg shadow-2xl"
```

Windows are mounted by `layout.layout.open.map(...)` in `packages/react-devbelt/src/ui/toolbar.tsx:177` and unmount instantly. This plan adds an enter only; adding an exit would need `AnimatePresence` and is out of scope.

## Target

An enter transition driven by Tailwind v4's `starting:` variant (`@starting-style`), the same mechanism the dialog uses (`data-starting-style`). It animates the individual `opacity` and `scale` properties, so it never touches the `translate` used for dragging.

```tsx
// target (add these tokens to the existing class string)
transition-[opacity,scale] duration-150 ease-out starting:scale-[0.98] starting:opacity-0 motion-reduce:starting:scale-100
```

150 ms, strong ease-out, scale from 0.98 (never from 0). Origin stays center: the window is a free-floating surface, like a modal.

## Repo conventions to follow

- Exemplar: `packages/react-devbelt/src/plugins/network/panel.tsx:131` uses `transition-[opacity,scale]`, `data-starting-style:scale-[0.98]` and `data-starting-style:opacity-0`.
- `motion-reduce:starting:scale-100` keeps the fade but drops the scale under reduced motion.

## Steps

1. Confirm plans 001 and 007 are applied (`grep -n "translate:var(--x)" packages/react-devbelt/src/ui/floating-window.tsx` and `grep -n "ease-out:" packages/react-devbelt/src/ui/global.css`). If not, STOP and report.
2. Append the target tokens to the `className` on `floating-window.tsx` line 145.
3. Verify the Tailwind build accepts the `starting:` variant: `pnpm --filter react-devbelt build:css` succeeds and `dist/styles.css` contains `@starting-style`.

## Boundaries

- Do NOT add an exit animation or `AnimatePresence`.
- Do NOT put `transition` on `translate`, `width` or `height` (it would lag dragging and resizing).
- Do NOT change window markup.
- If `@starting-style` isn't emitted, STOP and report rather than switching to keyframes.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm test && pnpm lint && pnpm build` pass.
- **Feel check**: click a toolbar plugin to open its window:
  - it fades in with a barely-perceptible scale from 0.98 over 150 ms; it does not feel slow;
  - dragging and resizing are unchanged (no lag, no easing);
  - toggling the plugin repeatedly never leaves it half-visible;
  - reduced motion emulated: a fade, no scale.
- **Done when**: windows enter with the transition and drag/resize behaviour is unchanged.
