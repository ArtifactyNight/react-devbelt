# 001 — Move floating windows with `translate`, not `top`/`left`

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits to `packages/react-devbelt/src/ui/*` when written; the excerpts below are from the working tree)
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, 1 line

## Problem

Dragging a plugin window moves it by rewriting `--x`/`--y` on every pointermove (`packages/react-devbelt/src/ui/floating-window.tsx:63-64`), and the class positions the element with `top`/`left`. Those are layout properties, so every pointermove runs layout and paint for the whole window. The dock does the same job correctly with `translate` (`packages/react-devbelt/src/ui/toolbar.tsx:227`: `[translate:var(--dock-x)_var(--dock-y)]`).

```tsx
// packages/react-devbelt/src/ui/floating-window.tsx:145 — current
className="pointer-events-auto fixed top-(--y) left-(--x) flex h-(--h) w-(--w) flex-col overflow-hidden rounded-xl border border-line bg-surface text-xs text-fg shadow-2xl"
```

## Target

Position is fixed at the viewport origin and the window is moved with the individual `translate` property. Width and height stay as they are, because resizing needs them.

```tsx
// target
className="pointer-events-auto fixed top-0 left-0 [translate:var(--x)_var(--y)] flex h-(--h) w-(--w) flex-col overflow-hidden rounded-xl border border-line bg-surface text-xs text-fg shadow-2xl"
```

No transition is added: dragging must follow the pointer 1:1.

## Repo conventions to follow

- Exemplar: `packages/react-devbelt/src/ui/toolbar.tsx:227` (`[translate:var(--dock-x)_var(--dock-y)]` with `--dock-x`/`--dock-y` in px).
- `--x`/`--y` are already set in px (`floating-window.tsx:63-64` and the `style` object near line 150), so no unit change is needed.

## Steps

1. In `packages/react-devbelt/src/ui/floating-window.tsx:145`, replace `top-(--y) left-(--x)` with `top-0 left-0 [translate:var(--x)_var(--y)]`. Change nothing else on the line.
2. Check that nothing else reads `top`/`left` of this element (`grep -n "style.top\|style.left\|offsetTop\|offsetLeft\|getBoundingClientRect" packages/react-devbelt/src/ui/floating-window.tsx packages/react-devbelt/src/ui/use-dev-layout.ts`). `getBoundingClientRect` is fine because it includes transforms. If code reads `offsetTop`/`offsetLeft`, STOP and report.

## Boundaries

- Do NOT touch the drag/resize logic, `clampRect`, or the width/height variables.
- Do NOT add a transition or `will-change`.
- Do NOT add dependencies.
- If the line doesn't match the excerpt, STOP and report.

## Verification

- **Mechanical**: from the repo root, `pnpm typecheck && pnpm test && pnpm lint` all pass.
- **Feel check**: run `examples/next-app` (or `vite-app`), open a plugin window, and:
  - drag it by the header: it tracks the pointer with no lag or offset, and snaps/clamps at viewport edges as before;
  - resize from the right, bottom and corner handles: unchanged behaviour;
  - reload: the window reopens at its saved position (layout is persisted under the `layout` key).
  - In DevTools Performance, record a 3 s drag; there should be no per-frame "Layout" entries attributable to the window.
- **Done when**: the one class change is in, and dragging and resizing behave identically.
