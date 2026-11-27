# react-devbelt

## 0.1.0

### Minor Changes

- d80996a: Agent tools can now return a failed result: `ToolResult` has an optional `isError` flag and `react-devbelt/core` exports `errorResult(text)`.
- d80996a: Plugins can mark Agent tools with `writes: true`; those stay off for browser agents until the app sets `agent: { write: true }` on the Plugin. Agent tool results are now marked as untrusted page content.
- b0320a8: The `breakpoint()` readout uses the Frame's real width, including a custom size and rotation. `base` names the range below the smallest breakpoint, and `outline` starts the outline on. Unpinning hides the readout and the outline toggle together, and the outline stops.
- d80996a: Add the opt-in `breakpoint()` plugin: shows the current breakpoint and width (e.g. `md · 812px`) in the toolbar and the debug bundle, using Tailwind v4's breakpoints or your own, and reports the Frame's width when it is active.
- d80996a: Add an outline-all-elements toggle to the `breakpoint()` plugin: it outlines every element on the page, and in the Frame when one is active, to make layout boxes visible. The toolbar and its windows are never outlined, and turning it off removes it completely.
- e033c67: First release: pluggable dev toolbar for React 19+ and Next.js with Network (fetch and XHR), Console, Viewport, Grab, Display and debug-bundle plugins, a shadow-root UI, WebMCP agent tools and a plugin API.
- d80996a: Add a Redaction helper (`isRedacted`, `redact`) that hides secret values by key while keeping their name and length; the default pattern is configurable.
- 77c10fd: Remove the opt-in `switcher()` plugin. Choosing a user, tenant, role or flag set needs each app to define what switching means, so it is not part of the Belt.
- d80996a: The `storage()` plugin can now edit a value, delete an entry and clear a store (localStorage, sessionStorage and readable cookies) from its Window. Redacted values can be replaced or deleted without being shown, and clearing keeps `devbelt:*` keys. The matching Agent tools (`devbelt_set_storage_item`, `devbelt_delete_storage_item`, `devbelt_clear_storage`) are write tools: they are off until `agent: { write: true }` is set on the plugin.
- a0b7747: The Storage Window updates when the page or a framed page writes storage, remembers the last-used tab, and notes that editing or clearing a cookie does not affect one on another path.
- d80996a: Add an opt-in `storage()` plugin: a read-only Window over localStorage, sessionStorage and readable cookies, with a read Agent tool and a Debug bundle section. Secret values are Redacted, its own `devbelt:*` keys are hidden, and the bundle carries key names and sizes unless `includeValuesInBundle` is set.
- 734db1e: The Storage Window has a tab per enabled store, a filter, a detail view and an add-entry control. `stores` chooses which stores the Window, Agent tools and Debug bundle include. Long values are shortened in the list and in the detail until expanded. Redacted values stay hidden until revealed.

### Patch Changes

- d80996a: Breakpoint: invalid breakpoints (non-positive or unparseable widths, duplicate names) now throw when the Plugin is created, with the entry named. New read-only Agent tool `devbelt_get_breakpoint`, a `base` option to name the range below the smallest breakpoint, a Debug line that notes when the width is the Frame's, and the outline setting now survives a reload.
- b9189a4: Animate the toolbar collapse, the viewport pill, and the viewport label with Motion springs.
- d80996a: Storage: a Redacted value can be revealed one row at a time (hidden again when the Window closes), Clear asks for confirmation, a blocked store shows an unavailable state instead of an empty list, and the read Agent tool takes `store`, `prefix` and `limit` (default 50, maximum 100). Writing Agent tools are annotated as not read-only.
