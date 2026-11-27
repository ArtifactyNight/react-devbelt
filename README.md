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
| `storage()` (opt-in) | `redact` | Keys whose values are Redacted. Default `/token\|secret\|password\|auth\|session\|jwt\|key/i` |
| | `includeValuesInBundle` | Put values in the Debug bundle too (Redacted ones stay hidden). Default `false`: key names and sizes only |
| `display()` | `darkClass` | Class toggled on `<html>` for dark mode. Default `"dark"`; `false` hides the switch |
| | `locale` | `{ cookie, options, default? }` adds a language switch that sets a cookie and reloads |
| `breakpoint()` | `breakpoints` | Name to minimum width (px number or `"48rem"`/`"768px"`). Default: Tailwind v4's `sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem` |

### Breakpoint indicator (opt-in)

`breakpoint()` is not in the defaults. Add it to your own list to show the current breakpoint and width at the end of the toolbar (e.g. `md · 812px`), updating as you resize. While the Viewport frame is active it reports the frame's width, not the window's. The Debug bundle gets a `Breakpoint` line. Below your smallest breakpoint it shows `base`.

```tsx
import { breakpoint } from "react-devbelt/plugins";

breakpoint(); // Tailwind v4 breakpoints
breakpoint({ breakpoints: { tablet: "48rem", desktop: 1200 } });
```

<<<<<<< HEAD
### Storage (opt-in)

`storage()` is not in the default list; add it by name: `[...defaultPlugins(), storage()]`. Its Window shows localStorage, sessionStorage and readable cookies, read-only, grouped by store. It hides its own `devbelt:*` keys and says that HttpOnly cookies cannot be seen. Values whose key matches the `redact` pattern show only their name and length, in the Window, in the `devbelt_get_storage` Agent tool and in the Debug bundle. The bundle lists key names and sizes; values appear only with `includeValuesInBundle`, and Redacted ones never do.
=======
### Switcher (opt-in)

`switcher()` lets a person choose among named Options the app defines: a user, a tenant, a role, a flag set. It does not know what choosing means; your `apply` does. One Plugin is one Axis, so add one instance per Axis. The Toolbar shows the current Option at its end, a window lists the Options, and the Debug bundle gets a line with the current one. The page reloads after `apply` unless `reload: false`. It is not in the defaults.

| Option | Meaning |
| --- | --- |
| `id` | Unique Plugin id for this Axis, e.g. `role` |
| `name` | Label in the Toolbar and Debug bundle. Default: the id |
| `options` | `{ id, label, description? }[]`, or a function returning them (so one Axis can depend on another) |
| `apply(id)` | What choosing an Option does: set a cookie, call an API, write localStorage. May be async |
| `current()` | The id of the active Option |
| `reload` | Reload after `apply`. Default `true` |

```tsx
import { defaultPlugins, switcher } from "react-devbelt/plugins";

const tenantAxis = switcher({
  id: "tenant",
  options: [
    { id: "acme", label: "Acme" },
    { id: "globex", label: "Globex", description: "Enterprise plan" },
  ],
  apply: (id) => localStorage.setItem("tenant", id),
  current: () => localStorage.getItem("tenant") ?? "acme",
});

const roleAxis = switcher({
  id: "role",
  // depends on the tenant Axis
  options: () =>
    localStorage.getItem("tenant") === "globex"
      ? [{ id: "viewer", label: "Viewer" }]
      : [{ id: "admin", label: "Admin" }, { id: "viewer", label: "Viewer" }],
  apply: (id) => document.cookie = `role=${id}; path=/`,
  current: () => document.cookie.match(/role=(\w+)/)?.[1],
});

<DevBelt plugins={[...defaultPlugins(), tenantAxis, roleAxis]} />;
```

Agent tools: `list_<id>_options` (read) and `switch_<id>` (a write tool, off until you set `agent: { write: true }` on the Plugin, see ADR 0003). `window.devbelt.switch_<id>({ id })` is the same call.
>>>>>>> ticket/05-switcher-plugin

## `<DevBelt>` props

| Prop | Default | |
| --- | --- | --- |
| `plugins` | built-ins | The tools to show |
| `isolation` | `"shadow"` | `"none"` renders in a plain div; import `react-devbelt/styles.css` yourself |
| `enabled` | `true` | Switch the toolbar off in development without removing it |

## Security

The toolbar reads request and response **bodies** and console output. Credentials in headers are masked, but bodies are not. It is built for development: do not ship it to production (production builds drop it) and do not expose it on shared or demo environments. Tools offered to browser agents are read-only apart from changing the viewport, and everything they return is marked as untrusted content.

## Writing a plugin

See [docs/plugins.md](docs/plugins.md).

## License

MIT. Bundles ui-sdk (Apache-2.0); see `NOTICE`.
