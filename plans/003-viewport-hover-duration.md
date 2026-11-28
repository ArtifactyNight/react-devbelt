# 003 — Drop the 300ms hover duration on viewport toggles

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1 token

## Problem

The viewport preset buttons sit in the toolbar and are hovered and pressed constantly. They override the base `transition-colors` (Tailwind default, 150ms) with `duration-300`. Hover color changes should be 150ms or less, and 300ms also makes the text color lag behind the sliding pill, which settles in about 250ms (spring stiffness 800, damping 40).

```tsx
// packages/react-devbelt/src/plugins/viewport/index.tsx:137 — current
className={`${toolbarItemClass} px-3 duration-300 data-pressed:text-fg-inverse data-pressed:hover:bg-transparent`}
```

`toolbarItemClass` (`packages/react-devbelt/src/ui/styles.ts:4`) already contains `transition-colors`.

## Target

Remove only `duration-300`; the item inherits the 150ms base from `transition-colors`.

```tsx
// target
className={`${toolbarItemClass} px-3 data-pressed:text-fg-inverse data-pressed:hover:bg-transparent`}
```

## Repo conventions to follow

- Every other toolbar item (`packages/react-devbelt/src/ui/default-item.tsx:42`) uses `toolbarItemClass` with no duration override.

## Steps

1. In `packages/react-devbelt/src/plugins/viewport/index.tsx:137`, delete the `duration-300 ` token. Nothing else changes.

## Boundaries

- Do NOT edit `toolbarItemClass` or the pill's spring.
- Do NOT touch other `duration-*` usages.
- If the line differs, STOP and report.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm lint` pass.
- **Feel check**: in an example app, click through `Full / Mobile / Tablet / Desktop` presets:
  - the selected label's color flips to the inverse color in step with the pill arriving, not visibly after it;
  - hover on the preset buttons feels the same as on the other toolbar buttons.
  - At 10% playback in DevTools Animations, the label color finishes no later than the pill.
- **Done when**: no `duration-300` remains in `viewport/index.tsx` and the label no longer trails the pill.
