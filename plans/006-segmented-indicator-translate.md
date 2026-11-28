# 006 — Move the language segmented indicator with `translate`

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file, 1 line
- **Depends on**: 007 (uses the `--ease-out` token)

## Problem

The locale selector's indicator transitions `top`, `left`, `width` and `height`, all layout properties, with Tailwind's default easing. It is small and rarely used, so the user-visible cost is low; the fix is cheap and makes it consistent with the rest.

```tsx
// packages/react-devbelt/src/plugins/display/panel.tsx:133 — current
<SegmentedControlIndicator className="pointer-events-none absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) z-0 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded bg-inverse transition-[top,left,width,height] duration-200" />
```

## Target

Position through `translate`, so only `width`/`height` (needed because items differ in size) remain layout properties, with the strong ease-out token.

```tsx
// target
<SegmentedControlIndicator className="pointer-events-none absolute top-0 left-0 [translate:var(--segmented-control-indicator-left)_var(--segmented-control-indicator-top)] z-0 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded bg-inverse transition-[translate,width,height] duration-200 ease-out" />
```

`ease-out` resolves to the strong curve once plan 007 is applied.

## Repo conventions to follow

- `[translate:var(--a)_var(--b)]` is the repo's pattern for var-driven positioning (`packages/react-devbelt/src/ui/toolbar.tsx:227`).

## Steps

1. Confirm plan 007 is applied (`grep -n "\-\-ease-out" packages/react-devbelt/src/ui/global.css`). If not, apply the class without `ease-out` and note it.
2. Confirm `--segmented-control-indicator-left`/`-top` hold values with units (px). Run the example, inspect the indicator's computed style in DevTools. If they are unitless numbers, STOP and report.
3. Replace the class string on `panel.tsx:133` as in the target.

## Boundaries

- Do NOT touch `SegmentedControlItem` or the surrounding markup.
- Do NOT change the 200ms duration.
- If the code doesn't match, STOP and report.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm lint` pass.
- **Feel check**: open the Display window, switch languages:
  - the indicator sits exactly behind the selected item at rest, in every locale;
  - it glides between items in 200 ms with a quick start and soft landing;
  - rapid switching retargets without a jump.
- **Done when**: the indicator is positioned identically at rest and no `top`/`left` is in the transition list.
