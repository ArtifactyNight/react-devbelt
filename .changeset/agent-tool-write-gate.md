---
"react-devbelt": minor
---

Plugins can mark Agent tools with `writes: true`; those stay off for browser agents until the app sets `agent: { write: true }` on the Plugin. Agent tool results are now marked as untrusted page content.
