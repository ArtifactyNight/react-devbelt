<div align="center">

# 🧰 react-devbelt

**A dev toolbar for React and Next.js. Network, console, viewport, grab. One belt.**

[![npm](https://img.shields.io/npm/v/react-devbelt?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/react-devbelt)
[![downloads](https://img.shields.io/npm/dm/react-devbelt?style=flat-square&color=blue)](https://www.npmjs.com/package/react-devbelt)
[![React](https://img.shields.io/badge/React-19+-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Next.js](https://img.shields.io/badge/Next.js-ready-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-typed-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![dev only](https://img.shields.io/badge/production-0%20bytes-brightgreen?style=flat-square)](#-security)
[![license](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](#license)
[![status](https://img.shields.io/badge/status-0.x-orange?style=flat-square)](#)

</div>

It floats over your app. It lives in a **shadow root** with its own stylesheet: no Tailwind needed, your CSS untouched. Dev-only: production builds contain none of it.

> ⚠️ `0.x`. The plugin API (`apiVersion: 1`) is the part most likely to change before 1.0.

## ✨ What you get

- 🌐 **Network**: every `fetch` and XHR, with bodies, a waterfall, cURL / fetch export and replay
- 🐛 **Console**: `console.error`, `console.warn`, uncaught errors and unhandled rejections, with stacks
- 📱 **Viewport**: frame the page as a phone, iPad, laptop or custom size (keys `1`–`6`)
- 🎯 **Grab**: point at an element (key `G`), copy it with its component stack and source location
- 🤖 **Debug bundle**: page, viewport, errors and failed requests in one paste for your AI assistant
- 🗄️ **Storage** *(opt-in)*: view, edit and clear localStorage, sessionStorage and readable cookies. Secret-looking values are Redacted
- 📐 **Breakpoint** *(opt-in)*: current breakpoint and width, plus an outline-everything toggle
- 📸 **Capture** *(opt-in)*: screenshots and screen recording
- ⚡ **TanStack Query** *(opt-in, separate package)*: queries and mutations, with refetch, invalidate and reset
- 🧠 **Agent tools**: everything above is readable by a browser agent through WebMCP and `window.devbelt`
- 🔌 **Plugins**: add your own. The built-ins are plugins too

## 📦 Install

```bash
npm install -D react-devbelt
```

Needs React 19+. Built on [ui-sdk](https://ui-sdk.dev) and bundles it. Nothing else to install.

### 🤖 Let an agent do it

Paste this into Claude Code, Cursor, Codex or any coding agent, from your project's folder. It sets up the default toolbar and leaves the rest alone.

```text
Install react-devbelt, a dev-only toolbar, in this project. Docs: https://github.com/ArtifactyNight/react-devbelt#readme

1. Read package.json. react-devbelt needs React 19 or newer. If this project uses an older React, stop and tell me; do not upgrade it.
2. Add `react-devbelt` as a dev dependency with the package manager this repo already uses (check the lockfile).
3. Set it up for the framework:
   - Next.js 16.3 or newer: in next.config.ts, wrap the exported config with `withDevBelt` from "react-devbelt/next". In the root layout (app/layout.tsx or src/app/layout.tsx), render `<DevBelt />` from "react-devbelt" once, inside <body> after {children}.
   - Next.js 15 or older: skip withDevBelt. Add `import "react-devbelt/install";` to instrumentation-client.ts (Next 15.3+; create it at the project root, or in src/ if the project uses src/) or to the top of a client entry. Render <DevBelt /> in the root layout as above.
   - Vite, Create React App or any other React app: make `import "react-devbelt/install";` the first import of the entry file (for example src/main.tsx), and render <DevBelt /> next to <App />.
4. Keep every other setting and file as it is. Do not wrap <DevBelt /> in an environment check: it renders nothing on the server and in production builds by itself.
5. Run the type check, start the dev server, and open the app. Confirm the toolbar shows at the bottom of the page. Then tell me which files you changed. Do not commit.
```

Want the opt-in tools (`storage()`, `breakpoint()`, `capture()`) later? Ask the agent to follow [Choosing and configuring plugins](#-choosing-and-configuring-plugins).

## ▲ Next.js (16.3+)

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

## ⚛️ React (Vite, CRA, anything)

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

`<DevBelt />` renders nothing on the server and in production. Its code sits behind a build-time `process.env.NODE_ENV` check, so a production bundle drops it entirely (verified against `next build`).

## 🎛️ Choosing and configuring plugins

You get Viewport, Grab, Network, Console, Display and Copy debug bundle by default. To tune them or add your own, make a **client module** that builds the list once:

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

### 💡 Toolbar tips

- Right-click (or long-press) a pinned tool for its own options (the same section as in More tools) and **Unpin from toolbar**.
- `Ctrl`/`⌘` + `.` collapses the toolbar to its chip (and brings back a hidden one). `Ctrl`/`⌘` + `/` hides everything, windows included, until you press it again. Both work with focus in a text field or in the framed page, and both are in More tools. Hiding is not saved: a reload shows the toolbar again.
- Text that changes while you watch it, such as the request count, the breakpoint readout and the "Copied" confirmations, morphs between values with [Torph](https://torph.lochie.me).

### 🧩 Opt-in plugins

Not in `defaultPlugins()`. Add them by name: `[...defaultPlugins(), storage(), breakpoint(), capture()]`.

| Plugin | From | What it does |
| --- | --- | --- |
| 📐 `breakpoint()` | `react-devbelt/plugins` | Current breakpoint and width, outline-all-elements toggle |
| 🗄️ `storage()` | `react-devbelt/plugins` | localStorage, sessionStorage and cookies, with Redaction |
| 📸 `capture()` | `react-devbelt/plugins` | Screenshot (page, region or full page; copied or saved as PNG) and screen recording (saved as a video) |
| ⚡ `tanstackQuery(client)` | `devbelt-plugin-tanstack-query` | TanStack Query v5 queries and mutations |

Each has its own section below, except TanStack Query: see [its package](packages/devbelt-plugin-tanstack-query).

### ⚙️ Built-in plugin options

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

### 📐 Breakpoint indicator (opt-in)

Shows the current breakpoint and width (e.g. `md · 812px`) next to an outline toggle, live as you resize. With a Frame up, it reports the Frame's real width, custom sizes included. Not the window, not the scaled-down on-screen size. Unpin the Plugin and the readout, toggle and outline all stop. The Debug bundle gets a `Breakpoint` line. Below your smallest breakpoint it shows `base`, or the name you pass as `base`.

```tsx
import { breakpoint } from "react-devbelt/plugins";

breakpoint(); // Tailwind v4 breakpoints
breakpoint({ breakpoints: { tablet: "48rem", desktop: 1200 }, base: "xs", outline: true });
```

### 📸 Screenshot and recording (opt-in)

`capture()` adds a camera, a region picker and a record button.

- **Camera**: copies a PNG of the page, toolbar left out (the Frame's page while one is up).
- **Crop**: drag over the page to copy just that region. `Esc` cancels. Over a Frame, the part outside it is left out.
- **More tools**: save a screenshot, or a full-page one.
- **Record**: uses the browser's own screen sharing. It asks what to share and shows its own indicator. Stopping saves a `.webm` (`.mp4` where that's all the browser can record). Hidden where screen capture isn't available.

Screenshots are rendered from the DOM with [modern-screenshot](https://github.com/qq15725/modern-screenshot), loaded on first use. No permission prompt. Cross-origin images without CORS headers come out blank.

While recording, the toolbar, its windows and popovers (and the size HUD) are hidden so they stay out of the video, then return when you stop. Turn that off with `capture({ hideWhileRecording: false })`, or per person in More tools ("Hide toolbar while recording", saved, wins over the option). To stop with the toolbar hidden, use the browser's own "Stop sharing" bar, or bring the toolbar back with `Ctrl`/`⌘` + `.`.

Paste a copied screenshot straight into an AI chat.

```tsx
import { capture } from "react-devbelt/plugins";

capture(); // screenshots at the screen's pixel ratio
capture({ scale: 1 }); // smaller files
capture({ hideWhileRecording: false }); // keep the toolbar in the video
```

### 🗄️ Storage (opt-in)

Add it by name: `[...defaultPlugins(), storage()]`.

Its Window has a tab per enabled store (localStorage, sessionStorage and readable cookies by default; pass `stores` to drop one), a filter, and a detail area. Open an entry to see its value in the JSON view, shortened until you expand it. You can add, edit and delete entries, or clear the active store. Redacted values stay hidden until revealed, and can be replaced or deleted without being shown. `devbelt:*` keys are never touched.

- **Write Agent tools** (`devbelt_set_storage_item`, `devbelt_delete_storage_item`, `devbelt_clear_storage`) are off until you set `agent: { write: true }` on the plugin.
- **HttpOnly cookies** can't be seen, and it says so.
- **Redaction**: values whose key matches `redact` show only name and length, in the Window, in `devbelt_get_storage` and in the Debug bundle.
- **Debug bundle**: key names and sizes. Values only with `includeValuesInBundle`, and Redacted ones never.

## 🧱 `<DevBelt>` props

| Prop        | Default    |                                                                             |
| ----------- | ---------- | --------------------------------------------------------------------------- |
| `plugins`   | built-ins  | The tools to show                                                           |
| `isolation` | `"shadow"` | `"none"` renders in a plain div; import `react-devbelt/styles.css` yourself |
| `panelMode` | `"window"` | How tools open: `"window"` is a floating window; `"popover"` is a panel on the tool's toolbar item, one at a time. People switch it in More tools, and that choice is remembered |
| `aiTools` | Cursor, Claude Code, Codex | The AI tools offered by "Open debug bundle in" and Grab's "After grabbing" in More tools. See [AI tools](#-ai-tools) |
| `enabled`   | `true`     | Switch the toolbar off in development without removing it                   |

## 🤝 AI tools

**Open debug bundle in** (More tools) and **After grabbing** (a saved choice that also opens what Grab copied) hand a prompt to an AI coding tool on the same machine, through its deep link. The prompt is filled in, not sent. You read it, then press Enter.

| Tool | Link | Notes |
| --- | --- | --- |
| Cursor | `cursor://anysphere.cursor-deeplink/prompt?text=…` | Opens in the focused Cursor window |
| Claude Code | `claude-cli://open?q=…` | Works once Claude Code has run an interactive session on the machine, which registers the link handler |
| Codex | `codex://new?prompt=…` | The Codex app |

A prompt over 5,000 characters doesn't fit in a link. It's copied instead, the tool is opened empty where it has such a link (Claude Code), and the toolbar says "Copied · paste into …". Add your own tool, or drop one, with the `aiTools` prop. Create the array once, at module level:

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

## 🔒 Security

The toolbar reads request and response **bodies** and console output. Header credentials are masked. Bodies are not.

- 🚫 Built for development. Production builds drop it. Don't expose it on shared or demo environments.
- 👀 Tools offered to browser agents are read-only, apart from changing the viewport. Everything they return is marked as untrusted content.
- ✍️ Tools that change state (editing storage, refetching or invalidating queries) don't exist until you set `agent: { write: true }` on that Plugin.
- 🙈 Values whose key looks secret (`token`, `password`, `auth`, `session`, `jwt`, `key`, and so on) are Redacted in the Toolbar, in Agent tools and in the Debug bundle.

## 🛠️ Writing a plugin

See [docs/plugins.md](docs/plugins.md).

## License

MIT. Bundles ui-sdk (Apache-2.0); see `NOTICE`.
