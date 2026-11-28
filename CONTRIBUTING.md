# Contributing

```bash
pnpm install
pnpm build          # compiles the stylesheet, then the package
pnpm test           # vitest (jsdom)
pnpm typecheck
pnpm lint
```

- `packages/react-devbelt/src/core` must not import React. It is the framework-free half and ships as `react-devbelt/core`.
- Every built-in tool is a plugin in `src/plugins/<name>/`. A new tool should use the plugin API rather than reach into the toolbar.
- Styles are Tailwind classes in the components, using only the semantic tokens from `packages/react-devbelt/src/ui/global.css` (see `DESIGN.md`; no raw palette colours); `scripts/build-css.mjs` compiles them into the shadow-root stylesheet. Run `pnpm build:css` after adding classes if you test without a full build.
- Try changes in `examples/vite-app` (`pnpm --filter devbelt-example-vite dev`) and `examples/next-app`. Shadow DOM behaviour (popups, focus, styling) is only trustworthy in a real browser, not in jsdom.
- Add a changeset for user-visible changes: `pnpm changeset`.
