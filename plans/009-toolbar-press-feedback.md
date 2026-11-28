# 009 — Add press feedback to shared toolbar button classes

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: LOW (additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, 3 class strings
- **Depends on**: 003 (viewport buttons no longer override the duration), 007 (`ease-out` token)

## Problem

Toolbar items, icon buttons and chips have a hover color but nothing on press, so clicks feel slightly dead. A subtle `scale(0.97)` on `:active` fixes that for every plugin at once, because plugins share these classes.

```ts
// packages/react-devbelt/src/ui/styles.ts — current
export const toolbarItemClass =
  "relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-fg transition-colors hover:bg-hover focus-visible:outline-2 ... [&_svg]:text-fg-icon [&_svg]:transition-colors data-pressed:[&_svg]:text-fg";
// line 13
export const iconButtonClass =
  "inline-flex size-7 items-center justify-center rounded-md text-fg-icon hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus";
// line 16
export const chipClass =
  "inline-flex h-6 items-center gap-1 rounded-full border border-line-strong px-2.5 text-[11px] font-medium text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus data-pressed:border-line-inverse data-pressed:bg-inverse data-pressed:text-fg-inverse";
```

(The classes in `...` are unchanged; open the file to see the full strings.)

## Target

Each of the three classes gets, and keeps, these tokens: `active:scale-[0.97]` and a transition covering the existing color changes plus `scale`, 150 ms, strong ease-out.

- `toolbarItemClass`: replace `transition-colors` with `transition-[color,background-color,scale] duration-150 ease-out` and add `active:scale-[0.97]`.
- `iconButtonClass`: add `transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.97]` (it has no transition at all today; the color change becomes smooth too).
- `chipClass`: add `transition-[color,background-color,border-color,scale] duration-150 ease-out active:scale-[0.97]`.

Leave `[&_svg]:transition-colors` as is.

## Repo conventions to follow

- Shared classes live in `packages/react-devbelt/src/ui/styles.ts`; plugins import them, so nothing else needs editing.
- Tailwind v4 `scale-*` uses the individual `scale` property, which can be transitioned directly, as the dialog already does (`network/panel.tsx:131`).

## Steps

1. Confirm plans 003 and 007 are applied. If not, STOP and report.
2. Edit the three exported strings in `styles.ts` as described. Do not change any other token.
3. Run `grep -rn "toolbarItemClass\|iconButtonClass\|chipClass" packages/react-devbelt/src` and look at each use for an element that already sets its own `transition-*`/`scale`; if one does, STOP and report that location.

## Boundaries

- Do NOT add press feedback to the tooltip, window bodies, or table rows.
- Do NOT use a scale below 0.95 or above 0.98.
- Do NOT add `will-change`.
- If a string doesn't match the file, STOP and report.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm test && pnpm lint && pnpm build` pass.
- **Feel check**: in an example app, press and hold a toolbar item, a window's close button and a chip:
  - each shrinks very slightly (3%) while held and returns on release, with no layout shift of neighbours;
  - hover color changes are the same speed as before (150 ms);
  - the viewport pill is unaffected (the pill is a separate element).
  - Reduced motion: the press scale is acceptable (3% is not vestibular), but if the project wants it off, add `motion-reduce:active:scale-100`.
- **Done when**: all three classes carry press feedback and nothing else changed visually.
