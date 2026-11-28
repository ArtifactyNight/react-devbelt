# 007 — Add CSS easing tokens and apply them to the fullscreen dialog

- **Status**: TODO
- **Commit**: b9189a4 (working tree had uncommitted edits; excerpts are from the working tree)
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 files, ~6 lines

## Problem

Motion on the JS side has one shared spring (`packages/react-devbelt/src/ui/motion.ts`), but CSS transitions have no tokens and use Tailwind's default easing. The fullscreen dialog enters and exits with the same 200 ms and the default curve; entrances should use a strong ease-out and exits should be quicker.

```tsx
// packages/react-devbelt/src/plugins/network/panel.tsx:131 — current (classes only, abbreviated)
className="fixed inset-4 m-0 flex h-auto max-h-none w-auto max-w-none flex-col overflow-hidden rounded-xl border border-line bg-surface p-0 text-xs text-fg shadow-2xl transition-[opacity,scale] duration-200 backdrop:bg-scrim data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none"
```

## Target

Tokens in the theme, and the dialog using them:

```css
/* packages/react-devbelt/src/ui/global.css, inside the existing `@theme static { ... }` block */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

In Tailwind v4 an `--ease-*` theme variable replaces the utility of the same name, so `ease-out` now means the strong curve. Nothing in `src` currently uses `ease-out`/`ease-in-out` (`grep -rnE "ease-(out|in-out)" packages/react-devbelt/src --exclude=styles.generated.ts`; confirm it returns nothing before proceeding).

```tsx
// panel.tsx:131 — target (only these tokens change)
... transition-[opacity,scale] duration-200 ease-out data-ending-style:duration-150 backdrop:bg-scrim ...
```

Enter: 200 ms strong ease-out. Exit: 150 ms (the system should leave quicker than it arrives).

## Repo conventions to follow

- Tokens and their rationale live in `packages/react-devbelt/src/ui/global.css` (header comment points to `/DESIGN.md`); add a one-line mention of the new motion tokens in `/DESIGN.md` next to its token table if it has a motion section, otherwise skip.
- `styles.generated.ts` is build output and gitignored: do not edit it; `pnpm build:css` regenerates it.

## Steps

1. Run the grep above. If any existing `ease-out`/`ease-in-out` utility appears, STOP and report.
2. Add the two variables to the `@theme static` block in `global.css`.
3. Edit `network/panel.tsx:131`: add `ease-out` and `data-ending-style:duration-150` after `duration-200`.
4. Run `pnpm --filter react-devbelt build:css` and check the output (`dist/styles.css`) contains `cubic-bezier(0.23, 1, 0.32, 1)`.

## Boundaries

- Do NOT add a `--duration-*` scale in this plan.
- Do NOT edit other components' transitions here (plans 006, 008, 009 do that).
- Do NOT edit generated files.

## Verification

- **Mechanical**: `pnpm typecheck && pnpm test && pnpm lint && pnpm build` pass.
- **Feel check**: open Network, click the fullscreen icon:
  - it fades in with a slight scale from 0.98, fast at the start, soft at the end;
  - closing is visibly quicker than opening;
  - with reduced motion emulated the transition is still off (`motion-reduce:transition-none` is untouched).
- **Done when**: tokens exist in `dist/styles.css` and the dialog uses them.
