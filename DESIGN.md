# Design

How the Toolbar looks and why. The tokens themselves live in one file,
[`packages/react-devbelt/src/ui/global.css`](packages/react-devbelt/src/ui/global.css);
this document explains the rules around them. Terms (Toolbar, Window, Item, Overlay, Frame) follow
[`GLOSSARY.md`](GLOSSARY.md).

## Principles

1. **Stay out of the way.** The Belt sits on top of someone else's app. Chrome is dark, quiet and
   small (12px base), so the page under test stays the subject.
2. **Dark only.** The Toolbar does not follow `prefers-color-scheme` or the host app's theme. A
   fixed dark surface reads the same over any page. The one light surface is the page preview in
   the Frame, which is the user's app, not our chrome.
3. **Hierarchy by value, not hue.** Emphasis is white at decreasing opacity. Colour is kept for
   meaning: the accent says "live or focused", status colours say "ok, redirect, error".
4. **One accent.** Sky is the only brand colour. Emerald, amber and rose are status, never
   decoration.
5. **Isolated.** Tokens are CSS custom properties on `:root, :host`, so they work inside the shadow
   root and with `isolation="none"`. Nothing is read from the host page.

## Two layers of tokens

| Layer | Names | Rule |
| --- | --- | --- |
| Primitives | `--palette-*` | The raw palette. Defined once in `global.css`, pointing at Tailwind colours. **Never used in a component.** |
| Semantic | `--color-<role>` | Named by what the colour is *for*. Generate the Tailwind utilities (`bg-surface`, `text-fg-secondary`, `border-line`). **The only colours components use.** |

Retheming means editing the primitives or re-pointing a semantic token. No component changes.

### Rules

- Never write a palette utility (`bg-neutral-950`, `text-white/70`, `border-sky-400`) or a hex/rgb
  value in a component. If no token fits, add one to `global.css` (and to the table below) first.
- Name tokens by role (`surface-raised`), not by appearance (`dark-grey`).
- Prefer an existing opacity step over a one-off. The accent and status tokens take Tailwind's
  opacity modifier (`bg-accent/15`) for tints; neutral steps already have named tokens.
- Pair fills and text: text on `inverse` is `fg-inverse`; text on `accent-strong` or
  `success-strong` is `fg`.
- Focus is always `focus-visible:outline-2 focus-visible:outline-focus`. Never remove an outline
  without replacing it.
- Interactive states are `hover`, then `pressed` (toggle on), then `line-inverse` + `inverse` for
  the strongest selected state. Do not invent intermediate whites.

## Tokens

### Surfaces

| Token | Use |
| --- | --- |
| `surface` | Toolbar, Windows, menus, dialogs |
| `surface-raised` | Tooltips, popovers, the backdrop behind the Frame |
| `surface-header` | Window title bar |
| `surface-overlay` | HUD chips drawn over the page (viewport size readout) |
| `surface-sticky` | Controls that float over scrolled content |
| `scrim` | Behind modal dialogs |
| `page` | The previewed page inside the Frame. Not toolbar chrome |

### Foreground

| Token | Use |
| --- | --- |
| `fg` | Primary text, pressed icons |
| `fg-secondary` | Supporting text, inactive tabs |
| `fg-tertiary` | Captions, timestamps, empty states |
| `fg-disabled` | Placeholders, disabled text |
| `fg-icon` | Resting icons; they brighten to `fg` when pressed |
| `fg-inverse` | Text on an `inverse` fill |

### Fills

| Token | Use |
| --- | --- |
| `inverse`, `inverse-hover` | High-emphasis control: primary button, selected pill, switch thumb |
| `hover` | Hover and highlighted rows |
| `hover-subtle` | Subtle row hover, input wells, bar tracks |
| `pressed` | A toggle that is on |
| `track` | Switch track |

### Borders

| Token | Use |
| --- | --- |
| `line` | Default hairline: Window, menu and separator borders |
| `line-strong` | Chips, inputs, secondary buttons |
| `line-control` | Checkboxes, keycaps |
| `line-inverse` | Selected or pressed outline |

### Accent, status, syntax

| Token | Use |
| --- | --- |
| `accent`, `accent-strong`, `accent-fg` | Selection, the Grab picker, live indicators; solid badge; accent text and icons |
| `focus` | Keyboard focus ring (aliases `accent`) |
| `success`, `success-strong`, `success-fg` | 2xx dots, picked elements; solid badge; text |
| `warning`, `warning-fg` | 3xx dots; text |
| `danger`, `danger-fg` | Errors, failed requests, destructive actions |
| `syntax-key`, `syntax-string`, `syntax-number`, `syntax-literal`, `syntax-punctuation` | JSON and code views |

## Shape, depth and type

These are still plain Tailwind scales, applied consistently:

- **Radius:** `rounded-full` for the Toolbar and its Items, `rounded-xl` for Windows, menus and
  dialogs, `rounded-md` for buttons and inputs, `rounded` for small inline controls.
- **Depth:** `shadow-lg` for the Toolbar and tooltips, `shadow-2xl` for Windows, menus and dialogs.
  Depth comes from shadow plus a `line` border, never from a lighter surface alone.
- **Type:** `ui-sans-serif` at 12px (`text-xs`), `text-[11px]` for dense rows and chips, `font-mono`
  for data (URLs, headers, storage values), `tabular-nums` for changing numbers.
- **Hover:** one highlight per strip or menu that glides from item to item (Fluid Functionalism's fluid
  hover, `ui/use-fluid-hover.ts` and `ui/fluid-hover-highlight.tsx`, copied from its registry). The toolbar
  strip registers every enabled button; a menu follows ui-sdk's `data-highlighted` (`ui/menu-highlight.tsx`),
  so arrows and the pointer move the same fill. Items carry no `hover:bg-*` of their own.
- **Targets:** at least 24×24px (WCAG 2.5.8), measured on the element or on an `after:` pseudo-element that
  extends it: toolbar items are 32px with a 40px target (`toolbarItemClass`), window header buttons 24px with 32px,
  switches 20px with 24px. Text buttons use `textButtonClass`, list rows and fields `min-h-6`. An extended area
  never reaches another control. The window's edge resize handles stay 6px: wider ones would cover the scrollbar.
- **Cursor:** the pointer on anything pressable (a base rule in `global.css`); `cursor-grab` on drag handles, `cursor-default` on menu items.
- **Scrollbars:** `scrollbar-slim` (defined in `global.css`) on every scrolling area: a thin rounded `track` thumb on a transparent track, brighter on hover.
- **Motion:** the three Fluid Functionalism tiers in `src/ui/springs.ts`: `fast` (0.08s: colour fades,
  the chevron, status text), `moderate` (0.16s: the chip, the shared pills, switch thumbs, text morphs) and
  `slow` (0.24s, a little bounce: the toolbar, the size HUD, the fullscreen dialog). A dismissal uses the
  tier's `.exit` tween. Never a hand-written duration. Move with `transform` and `opacity` only. The
  toolbar sits in `<MotionConfig reducedMotion="user">`, so the OS setting drops movement and keeps fades;
  CSS transitions carry `motion-reduce:transition-none` or stay colour-only.

## Exceptions

One value sits outside the token set because it is injected into the host document, where
`--color-*` is not defined: the breakpoint Plugin's outline (`rgba(239, 68, 68, .6)` in
`plugins/breakpoint/index.tsx`). Keep it the only one.

Product logos are the other exception, taken from [svgl.app](https://svgl.app) rather than drawn: Cursor,
Claude Code and Codex in `plugins/ai-tool-icons.tsx`, TanStack Query in its package. Single-colour logos
use `currentColor` so they follow `fg-icon`; a logo with brand colours (Claude Code, TanStack Query) keeps them.

## Changing the system

1. Edit `global.css`. Add the primitive first if the colour is new, then the semantic token.
2. Update the tables in this file.
3. `pnpm build:css` regenerates the shadow-root stylesheet and `dist/styles.css`.
4. Check the Toolbar, a Window, a menu and the Grab picker by eye; the tests do not cover colour.
