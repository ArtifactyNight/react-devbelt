# react-devbelt

A pluggable dev toolbar for **React 19+ and Next.js**. It floats over your app and gives you:

- **Network**: every `fetch` and XHR, with bodies, a waterfall, cURL / fetch export and replay
- **Console**: `console.error`, `console.warn`, uncaught errors and unhandled rejections, with stacks
- **Viewport**: frame the page as a phone, iPad, laptop or custom size (keys `1`–`6`)
- **Grab**: point at an element (key `G`) and copy it with its component stack and source location
- **Debug bundle**: page, viewport, errors and failed requests in one paste for an AI assistant
- **Storage** *(opt-in)*: view, edit and clear localStorage, sessionStorage and readable cookies; secret-looking values are Redacted
- **Breakpoint** *(opt-in)*: the current breakpoint and width in the Toolbar, plus an outline-all-elements toggle
- **TanStack Query** *(opt-in, separate package)*: queries and mutations at a glance, with refetch, invalidate and reset
- **Agent tools**: all of the above is also readable by a browser agent through WebMCP and `window.devbelt`
- **Plugins**: add your own tools; the built-ins are plugins too

It renders in a **shadow root** with its own stylesheet, so it needs no Tailwind and never touches your page's CSS. It is dev-only: production builds contain none of its code.

> Status: `0.x`. The plugin API (`apiVersion: 1`) is the part most likely to change before 1.0.

## Install

```bash
npm install -D devbelt
```

Requires React 19 or newer. The toolbar is built on [ui-sdk](https://ui-sdk.dev) and bundles it, so you install nothing else.

## Next.js (16.3+)

```ts
// next.config.ts: captures requests and errors before hydration
import { withDevBelt } from "react-devbelt/next";
export default withDevBelt({
  /* your config */
});
```

```tsx
// app/layout.tsx
import { DevBelt } from "react-devbelt";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <DevBelt />
      </body>
    </html>
  );
}
```

On Next 15 or earlier, skip `withDevBelt` and add `import "react-devbelt/install";` to `instrumentation-client.ts` (Next 15.3+) or the top of a client entry.

## React (Vite, CRA, anything)

```tsx
// src/main.tsx
import "react-devbelt/install"; // first, so early requests and errors are caught
import { createRoot } from "react-dom/client";
import { DevBelt } from "react-devbelt";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <DevBelt />
  </>,
);
```

`<DevBelt />` renders nothing on the server and in production builds. Its code sits behind a build-time `process.env.NODE_ENV` check, so a production bundle drops it entirely (verified against `next build`).

## Choosing and configuring plugins

By default you get Viewport, Grab, Network, Console, Display and Copy debug bundle. To configure them or add your own, make a **client module** that builds the list once:

```tsx
// devbelt.tsx
"use client";
import { DevBelt, installDevBelt } from "react-devbelt";
import {
  network,
  consolePlugin,
  viewport,
  grab,
  bundle,
  display,
} from "react-devbelt/plugins";

export const plugins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        viewport(),
        grab(),
        network({
          // header values are masked in the log; say what a replay should send
          replayHeaders: (name) =>
            name.toLowerCase() === "authorization"
              ? `Bearer ${getToken()}`
              : null,
        }),
        consolePlugin(),
        bundle(),
        display({
          darkClass: "dark",
          locale: { cookie: "locale", options: ["en", "th"] },
        }),
      ];

installDevBelt(plugins); // optional: start capturing before the app renders

export const Toolbar = () => <DevBelt plugins={plugins} />;
```

Create the array once at module level, not inside a component. With your own list, do not also `import "react-devbelt/install"`; whichever runs first decides each plugin's options.

### Toolbar tips

- Right-click (or long-press) a pinned tool for its own options (the same section as in More tools) and **Unpin from toolbar**.
- Text that changes while you watch it, such as the request count, the breakpoint readout and the "Copied" confirmations, morphs between values with [Torph](https://torph.lochie.me).

### Opt-in plugins

These are not in `defaultPlugins()`; add them by name: `[...defaultPlugins(), storage(), breakpoint(), capture()]`.

| Plugin | From | What it does |
| --- | --- | --- |
| `breakpoint()` | `react-devbelt/plugins` | Current breakpoint and width, outline-all-elements toggle |
| `storage()` | `react-devbelt/plugins` | localStorage, sessionStorage and cookies, with Redaction |
| `capture()` | `react-devbelt/plugins` | Screenshot (page, region or full page; copied or saved as PNG) and screen recording (saved as a video) |
| `tanstackQuery(client)` | `devbelt-plugin-tanstack-query` | TanStack Query v5 queries and mutations |

Each has its own section below, except TanStack Query, which is documented in [its package](packages/devbelt-plugin-tanstack-query).

### Built-in plugin options

| Plugin               | Option                             | Meaning                                                                                                                                      |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `network()`          | `redactHeaders`                    | Header names to mask. Default: `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`                                   |
|                      | `replayHeaders(name, maskedValue)` | What a replayed request sends for a header. Return `null` to leave it out (the default for redacted headers)                                 |
|                      | `fetch`                            | Also record `fetch`. Default `true`                                                                                                          |
| `storage()` (opt-in) | `stores`                           | Which stores the Window, Agent tools and Debug bundle include. Any of `localStorage`, `sessionStorage`, `cookies`. Default: all three          |
|                      | `redact`                           | Keys whose values are Redacted. Default `/token\|secret\|password\|auth\|session\|jwt\|key/i`                                                |
|                      | `includeValuesInBundle`            | Put values in the Debug bundle too (Redacted ones stay hidden). Default `false`: key names and sizes only                                    |
| `display()`          | `darkClass`                        | Class toggled on `<html>` for dark mode. Default `"dark"`; `false` hides the switch                                                          |
|                      | `locale`                           | `{ cookie, options, default? }` adds a language switch that sets a cookie and reloads                                                        |
| `breakpoint()`       | `breakpoints`                      | Name to minimum width (px number or `"48rem"`/`"768px"`). Default: Tailwind v4's `sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem` |
|                      | `base`                             | Name of the range below the smallest breakpoint. Default `"base"`                                                                           |
|                      | `outline`                          | Start with the outline on. Default `false`. A saved choice wins after the first toggle                                                      |

### Breakpoint indicator (opt-in)

`breakpoint()` is not in the defaults. Add it to your own list to show the current breakpoint and width (e.g. `md · 812px`) next to an outline toggle, updating as you resize. While a Frame is active it reports that Frame's real width, including a custom size, not the surrounding window and not the scaled-down on-screen size. Unpinning the Plugin hides the readout and the toggle together, and the outline stops. The Debug bundle gets a `Breakpoint` line. Below your smallest breakpoint it shows `base`, or the name you pass as `base`.

```tsx
import { breakpoint } from "react-devbelt/plugins";

breakpoint(); // Tailwind v4 breakpoints
breakpoint({ breakpoints: { tablet: "48rem", desktop: 1200 }, base: "xs", outline: true });
```

### Screenshot and recording (opt-in)

`capture()` adds a camera, a region picker and a record button. The camera copies a PNG of the page without the toolbar (the device Frame's page while one is up). The crop button lets you drag over the page to copy just that region (Esc cancels; over a Frame, the part outside it is left out). More tools also saves a screenshot or a full-page one. It is rendered from the DOM with [modern-screenshot](https://github.com/qq15725/modern-screenshot), loaded on first use, so it needs no permission prompt; cross-origin images without CORS headers come out blank. The record button uses the browser's own screen sharing: the browser asks what to share and shows its own indicator, and stopping saves a `.webm` (`.mp4` where that is all the browser can record). It is hidden where screen capture is not available. Paste a copied screenshot straight into an AI chat.

```tsx
import { capture } from "react-devbelt/plugins";

capture(); // screenshots at the screen's pixel ratio
capture({ scale: 1 }); // smaller files
```

### Storage (opt-in)

`storage()` is not in the default list; add it by name: `[...defaultPlugins(), storage()]`. Its Window has a tab for each enabled store (localStorage, sessionStorage and readable cookies by default; pass `stores` to leave one out), a filter, and a detail area. Opening an entry shows the value in the JSON view, shortened until you expand it. You can add an entry, edit a value, delete an entry or clear the active store (Redacted values stay hidden until revealed, and can be replaced or deleted without being shown; `devbelt:*` keys are never touched). The write Agent tools (`devbelt_set_storage_item`, `devbelt_delete_storage_item`, `devbelt_clear_storage`) are off until you set `agent: { write: true }` on the plugin. It hides its own `devbelt:*` keys and says that HttpOnly cookies cannot be seen. Values whose key matches the `redact` pattern show only their name and length, in the Window, in the `devbelt_get_storage` Agent tool and in the Debug bundle. The bundle lists key names and sizes; values appear only with `includeValuesInBundle`, and Redacted ones never do.

## `<DevBelt>` props

| Prop        | Default    |                                                                             |
| ----------- | ---------- | --------------------------------------------------------------------------- |
| `plugins`   | built-ins  | The tools to show                                                           |
| `isolation` | `"shadow"` | `"none"` renders in a plain div; import `react-devbelt/styles.css` yourself |
| `panelMode` | `"window"` | How tools open: `"window"` is a floating window; `"popover"` is a panel on the tool's toolbar item, one at a time. People switch it in More tools, and that choice is remembered |
| `aiTools` | Cursor, Claude Code, Codex | The AI tools offered by "Open debug bundle in" and Grab's "After grabbing" in More tools. See [AI tools](#ai-tools) |
| `enabled`   | `true`     | Switch the toolbar off in development without removing it                   |

## AI tools

**Open debug bundle in** (More tools) and **After grabbing** (a saved choice that also opens what Grab copied) hand a prompt to an AI coding tool installed on the same machine, through its deep link. The prompt is filled in, not sent; the person reads it and presses Enter.

| Tool | Link | Notes |
| --- | --- | --- |
| Cursor | `cursor://anysphere.cursor-deeplink/prompt?text=…` | Opens in the focused Cursor window |
| Claude Code | `claude-cli://open?q=…` | Works once Claude Code has run an interactive session on the machine, which registers the link handler |
| Codex | `codex://new?prompt=…` | The Codex app |

A prompt over 5,000 characters does not fit in a link, so it is copied instead, the tool is opened empty where it has such a link (Claude Code), and the toolbar says "Copied · paste into …". Add your own tool, or drop one, with the `aiTools` prop; create the array once, at module level:

```tsx
import { defaultAiTools } from "react-devbelt/core";

const aiTools = [
  ...defaultAiTools,
  {
    id: "my-editor",
    label: "My editor",
    link: (prompt: string) => `my-editor://chat?prompt=${encodeURIComponent(prompt)}`,
    maxPrompt: 4000, // optional, default 5000
  },
];

<DevBelt aiTools={aiTools} />;
```

A plugin can use the same list: `openInAiTool(tool, text)` from `react-devbelt/core`, with the tools from `useToolbar().aiTools`.

## Security

The toolbar reads request and response **bodies** and console output. Credentials in headers are masked, but bodies are not. It is built for development: do not ship it to production (production builds drop it) and do not expose it on shared or demo environments. Tools offered to browser agents are read-only apart from changing the viewport, and everything they return is marked as untrusted content. Tools that change state (editing storage, refetching or invalidating queries) do not exist until you set `agent: { write: true }` on that Plugin. Values whose key looks secret (`token`, `password`, `auth`, `session`, `jwt`, `key`, and so on) are Redacted in the Toolbar, in Agent tools and in the Debug bundle.

## Writing a plugin

See [docs/plugins.md](docs/plugins.md).

## License

MIT. Bundles ui-sdk (Apache-2.0); see `NOTICE`.
