# Writing a plugin

A plugin is a plain object made with `definePlugin`. Every part is optional; add only what the tool needs. The built-in tools (`network`, `consolePlugin`, `viewport`, `grab`, `bundle`, `display`) are plugins and live in `packages/react-devbelt/src/plugins/`, so they double as examples.

```tsx
"use client";
import { definePlugin } from "react-devbelt";
import { ZapIcon } from "lucide-react";

export function counter() {
  return definePlugin({
    id: "counter", // lowercase, digits, dashes
    name: "Counter",
    icon: <ZapIcon className="size-4" aria-hidden="true" />,
    window: {
      size: { width: 320, height: 240, minWidth: 240, minHeight: 160 },
      Component: () => <p>Hello from a window</p>,
    },
  });
}
```

Use it: `<DevBelt plugins={[...defaults, counter()]} />`. Build the list once at module level.

## What a plugin can provide

| Field | What it does |
| --- | --- |
| `window` | A floating, draggable, resizable window plus a toggle button in the toolbar |
| `run(api)` | An action button. A returned string flashes beside the icon (`"Copied"`) |
| `Item` | Your own toolbar item instead of the default button |
| `Badge`, `Hint` | A count in the default toggle; extra tooltip text |
| `Overlay` | Rendered over the page, e.g. a picker or a device frame |
| `MenuSection` | Extra section in the More tools menu (use ui-sdk `Menu*` parts) |
| `Status`, `ChipStatus` | Text at the end of the toolbar / in the collapsed chip |
| `install()` | Runs once per frame, including the viewport iframe. Patch globals, register shortcuts, return a cleanup |
| `agentTools` | Tools for browser agents (WebMCP) and `window.devbelt`. Mark a tool that changes state with `writes: true` |
| `agent` | Set by the app: `agent: { write: true }` turns on this plugin's writing Agent tools |
| `debugContext()` / `debugSections()` | Lines and Markdown sections for "Copy debug bundle" |
| `styles` | CSS for your own markup (see below) |
| `pinned`, `separatorAfter`, `label`, `description` | Toolbar placement and accessible names |

## Styling

The toolbar's stylesheet is compiled once and only contains the Tailwind classes the built-ins use. To style your own markup, either:

- reuse the shared class names from `react-devbelt/ui` (`toolbarItemClass`, `chipClass`, `iconButtonClass`, `tooltipClass`, `kbdClass`), or
- ship CSS in `styles`; it is injected into the shadow root next to the toolbar's.

`react-devbelt/ui` also re-exports the ui-sdk parts the toolbar uses (Button, Toggle, Tooltip, Tabs, Popover, ...). Import them from there, not from `@ui-sdk/*`, so your plugin and the toolbar share one copy.

## The toolbar API

Inside any plugin component, `useToolbar()` gives you `openWindow(id)`, `closeWindow(id)`, `toggleWindow(id)`, `debugContext()`, `debugSections()`, `holdEscape()` (an overlay that handles Esc calls it so the toolbar doesn't close windows underneath) and `container` / `root` (where the toolbar renders). `run(api)` and agent tools receive the same object.

## Sharing state and capturing early

Keep a plugin's state in a module-level store read with `useSyncExternalStore`. Capture that must start before the app runs (patching `fetch`, listening for errors) goes in `install()`, and `installDevBelt(plugins)` runs it early. State that should survive a reload and be shared with the viewport iframe can use `createHostStore` from `react-devbelt/core`, which lives on the top window and persists to `sessionStorage`.

## Agent tools that write

Agent tools only read by default. A tool that changes state (edits storage, applies an option, invalidates a query) must say so with `writes: true`. Writing tools are not offered to browser agents, in WebMCP or on `window.devbelt`, until the app opts in on that plugin:

```tsx
<DevBelt plugins={[...defaults, { ...counter(), agent: { write: true } }]} />
```

A plugin can also set `agent` itself when it is built, but the app decides. Tools that only change how the page is framed, like `devbelt_set_viewport`, are not gated. Everything an Agent tool returns is marked untrusted: the text starts with `[untrusted page content: ...]` and the result carries `_meta: { "devbelt/untrusted": true }`. Return page data as it is; the toolbar adds the marker, so don't add your own.

## Errors and compatibility

A plugin that throws while installing or rendering loses only its own UI; the toolbar keeps working. `definePlugin` stamps `apiVersion: 1`; a plugin built for a newer API is rejected with a clear message. Name published plugins `devbelt-plugin-*` so people can find them.
