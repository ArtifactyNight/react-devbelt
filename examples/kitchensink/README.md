# Kitchen sink

One Vite app with every devbelt tool switched on, and something on the page to try each one on.

```bash
pnpm --filter devbelt-example-kitchensink dev
```

Open `http://localhost:5173` (or the port Vite prints). Add `?panel=popover` to open tools as popovers instead of windows; a choice made in the toolbar's **⋯** menu wins over it.

| Tool | Where it comes from | Try |
| --- | --- | --- |
| Viewport | `defaultPlugins()` | keys `1`–`6`, or the size buttons |
| Grab | `defaultPlugins()` | key `G`, then click, drag, or ⌘/Ctrl+click |
| Network | `defaultPlugins()` | the Network buttons; a token is masked, rows can be copied or replayed |
| Console | `defaultPlugins()` | the Console buttons, including an uncaught error |
| Copy debug bundle | `defaultPlugins()` | the clipboard button after some errors |
| Display | `display({ darkClass, locale })` | Dark mode and the `en` / `th` switch |
| Breakpoint | `breakpoint()` | frame the page and watch the grid; toggle the outline |
| Storage | `storage()` with `agent: { write: true }` | "Write some values"; keys like `auth-token` stay redacted |
| TanStack Query | `tanstackQuery(client)` | the query buttons; refetch, invalidate or reset from a row |
| App info | `src/app-info.tsx`, written with `definePlugin` | a plugin with a window, a debug line and an Agent tool |

The API the buttons call is a mock in `vite.config.ts`, so everything works offline. Browser agents see the Agent tools on `window.devbelt` (including the write tools for Storage and TanStack Query, which are on here only because of `agent: { write: true }`).
