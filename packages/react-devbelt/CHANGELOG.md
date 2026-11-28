# react-devbelt

## 0.2.0

### Minor Changes

- c95f85b: Open in an AI tool. More tools has "Open debug bundle in" and "After grabbing" (copy and also open in Cursor, Claude Code or Codex through its deep link). The prompt is filled in, not sent; one over 5,000 characters is copied instead. Add or drop tools with the `aiTools` prop, `useToolbar().aiTools` and `openInAiTool` from `react-devbelt/core`.
- f1e0bc4: `capture()` hides the toolbar, its windows, popovers and the size HUD while the screen is recorded, so none of it is in the video, and shows them again when the recording ends. Turn it off with `capture({ hideWhileRecording: false })` or, per person, with "Hide toolbar while recording" in More tools. The toolbar API gains `setHidden()` and `isHidden()`.
- 66ae4d9: Add the opt-in `capture()` plugin: a camera that copies a screenshot of the page (or the device Frame's page) without the toolbar, a crop button to drag out a region to copy, More tools items to save a screenshot or a full-page one, and a record button that saves a screen recording through the browser's screen sharing. Screenshots are rendered with modern-screenshot, loaded on first use.
- 5871c3c: Right-click (or long-press) a pinned tool for its own options and "Unpin from toolbar". Buttons on the toolbar show the pointer cursor.
- 7919014: Text that changes on the toolbar (request and error counts, the breakpoint and frame size readouts, "Copied" and other confirmations, the recording timer) morphs between values with Torph. Plugins can use `MorphText` from `react-devbelt/ui`.
- a0fb5a6: Add a panel mode: tools open as a floating window (default) or as a popover on their toolbar item. Set the default with `<DevBelt panelMode="popover" />`; people can change it in More tools and the choice is remembered. Grab now picks elements inside the viewport frame instead of the page behind it.
- 2db112d: Add `Ctrl/⌘ + .` to collapse the toolbar and `Ctrl/⌘ + /` to hide everything (and show it again), also from the framed page and from a text field, and list them in More tools and on the chip's tooltip. A line now separates every two tools on the toolbar.

### Patch Changes

- 2db112d: One hover highlight glides between the toolbar's buttons, and another between a menu's rows (keyboard and pointer alike), instead of each item lighting up on its own.
- 26f2490: Toolbar motion uses Fluid Functionalism's three spring tiers instead of one hand-tuned spring. The viewport pill and the language switch pill glide as shared-layout transforms, switch thumbs spring, the collapsed chip moves with `y` instead of `bottom`, and the OS reduced-motion setting now drops movement but keeps fades.
- 72b3ab4: Bigger click targets: toolbar buttons get a 40px-tall target, window header buttons and switches are easier to hit, the Storage panel's text buttons, the Console rows and the TanStack Query filter fields are at least 24px tall, and the window's resize corner and Grab's numbered markers are 24px.
- bef8079: Scrolling areas in the toolbar (windows, panels, the More tools menu) get a slim, rounded scrollbar that matches the dark theme.

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
