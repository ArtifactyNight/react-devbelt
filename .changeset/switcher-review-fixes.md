---
"react-devbelt": patch
---

Switcher: a rejected `apply` now shows an error and keeps the current Option instead of an unhandled rejection, an unknown Option id on the Agent tool returns an error result, and a throwing `current` no longer crashes the panel or the Debug bundle. The Plugin id is now `switcher-<axis id>` so it cannot collide with other Plugins, duplicate Option ids throw with a clear message, and installing two plugins with the same id throws.
