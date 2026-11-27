# Glossary

Language for react-devbelt. Terms only; how things work lives in `docs/`.

**Belt**:
The whole product: the floating bar and everything it carries, as one thing you add to an app.
_Avoid_: devtools (it is not a replacement for the browser's), dashboard

**Toolbar**:
The floating bar a person sees and clicks, docked near the bottom of the page. One part of the Belt.
_Avoid_: dock (that is only its resting position), panel

**Plugin**:
A unit of extension made with `definePlugin`. Everything the Belt does comes from plugins; the ones that ship with it are plugins too.
_Avoid_: tool, extension, add-on

**Built-in plugin**:
A Plugin shipped in the main package. It needs no library beyond what the package already carries.

**Package plugin**:
A Plugin published as its own package because it needs an optional third-party library (for example TanStack Query). That library is its peer dependency.

**Item**:
What a Plugin places on the Toolbar: a button, a toggle, or a custom control.

**Window**:
A floating panel a Plugin opens, which a person can drag, resize and stack.
_Avoid_: modal, popup (those are ui-sdk's menus and dialogs)

**Overlay**:
Something a Plugin draws over the page itself, such as the Frame or the Grab picker.

**Frame**:
The iframe that shows the page at a device size. Owned by the viewport Plugin.
_Avoid_: viewport (that names the size, not the iframe)

**Agent tool**:
A function the Belt offers to a browser agent (through WebMCP and `window.devbelt`). It is not a Plugin and not a button.
_Avoid_: tool on its own

**Debug bundle**:
One Markdown document that gathers the page's context for an AI assistant: where the page is, what it logged, which requests failed. Each Plugin may add to it. It never contains secrets.

**Switcher**:
A Plugin that lets a person choose among named Options the app defines (a user, a tenant, a role, a flag set). It does not know what choosing means; the app's `apply` does.
_Avoid_: identity switcher, persona

**Option**:
One entry a Switcher offers: an id, a label and an optional description.

**Axis**:
One independent thing a Switcher varies, such as user or tenant. Each Axis is its own Switcher instance.

**Redaction**:
Hiding a secret's value from the Toolbar, Agent tools and the Debug bundle while keeping the fact that it exists (a name, a length).

**Opt-in**:
Not part of the default Plugin list; the app adds it by name.

## Relationships

- The **Belt** shows a **Toolbar** and renders **Plugins**.
- A **Plugin** may provide an **Item**, a **Window**, an **Overlay**, **Agent tools** and a contribution to the **Debug bundle**.
- A **Switcher** is a **Plugin**; each **Axis** is one Switcher.
- A **Built-in plugin** and a **Package plugin** differ only in where they ship and what they depend on.

## Flagged ambiguities

- "tool" was used for Plugins, toolbar buttons and Agent tools. Resolved: say Plugin, Item or Agent tool. The menu label "More tools" is user-facing text and stays.
- "identity switcher" implied users only, but tenants and roles are not identities. Resolved: **Switcher** over **Options**.
- "viewport" named both a size and the iframe. Resolved: the iframe is the **Frame**; "viewport" means the size preset.
