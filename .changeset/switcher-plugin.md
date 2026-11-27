---
"react-devbelt": minor
---

Add the opt-in `switcher()` plugin: one Axis per instance (a user, tenant, role or flag set), with Options and an `apply` you define. The Toolbar shows the current Option, the page reloads after `apply` unless `reload: false`, and the Debug bundle records it. Its `switch_<id>` Agent tool is a write tool, off until `agent: { write: true }`.
