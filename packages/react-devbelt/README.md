# react-devbelt

A pluggable dev toolbar for **React 19+ and Next.js**. It floats over your app and gives you:

- **Network**: every `fetch` and XHR, with bodies, a waterfall, cURL / fetch export and replay
- **Console**: `console.error`, `console.warn`, uncaught errors and unhandled rejections, with stacks
- **Viewport**: frame the page as a phone, iPad, laptop or custom size (keys `1`–`6`)
- **Grab**: point at an element (key `G`) and copy it with its component stack and source location
- **Debug bundle**: page, viewport, errors and failed requests in one paste for an AI assistant
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
export default withDevBelt({ /* your config */ });
```

```tsx
// app/layout.tsx
import { DevBelt } from "react-devbelt";

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
import { network, consolePlugin, viewport, grab, bundle, display } from "react-devbelt/plugins";

export const plugins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        viewport(),
        grab(),
        network({
          // header values are masked in the log; say what a replay should send
          replayHeaders: (name) => (name.toLowerCase() === "authorization" ? `Bearer ${getToken()}` : null),
        }),
        consolePlugin(),
        bundle(),
        display({ darkClass: "dark", locale: { cookie: "locale", options: ["en", "th"] } }),
      ];

installDevBelt(plugins); // optional: start capturing before the app renders

export const Toolbar = () => <DevBelt plugins={plugins} />;
```

Create the array once at module level, not inside a component. With your own list, do not also `import "react-devbelt/install"`; whichever runs first decides each plugin's options.

### Built-in plugin options

| Plugin | Option | Meaning |
| --- | --- | --- |
| `network()` | `redactHeaders` | Header names to mask. Default: `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key` |
| | `replayHeaders(name, maskedValue)` | What a replayed request sends for a header. Return `null` to leave it out (the default for redacted headers) |
| | `fetch` | Also record `fetch`. Default `true` |
| `display()` | `darkClass` | Class toggled on `<html>` for dark mode. Default `"dark"`; `false` hides the switch |
| | `locale` | `{ cookie, options, default? }` adds a language switch that sets a cookie and reloads |

## `<DevBelt>` props

| Prop | Default | |
| --- | --- | --- |
| `plugins` | built-ins | The tools to show |
| `isolation` | `"shadow"` | `"none"` renders in a plain div; import `react-devbelt/styles.css` yourself |
| `panelMode` | `"window"` | How tools open: `"window"` is a floating window; `"popover"` is a panel on the tool's toolbar item, one at a time. People switch it in More tools, and that choice is remembered |
| `aiTools` | Cursor, Claude Code, Codex | The AI tools offered by "Open debug bundle in" and Grab's "After grabbing" in More tools. See [AI tools](#ai-tools) |
| `enabled` | `true` | Switch the toolbar off in development without removing it |

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

The toolbar reads request and response **bodies** and console output. Credentials in headers are masked, but bodies are not. It is built for development: do not ship it to production (production builds drop it) and do not expose it on shared or demo environments. Tools offered to browser agents are read-only apart from changing the viewport, and everything they return is marked as untrusted content.

## Writing a plugin

See [docs/plugins.md](../../docs/plugins.md).

## License

MIT. Bundles ui-sdk (Apache-2.0); see `NOTICE`.
