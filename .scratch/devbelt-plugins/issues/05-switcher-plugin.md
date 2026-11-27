# 05: Switcher Plugin

**What to build:** `switcher({ id, options, apply, current, reload? })`: an opt-in built-in Plugin where the app defines named Options and what choosing one means. One Axis per instance; `options` can be a list or a function so one Axis can depend on another. The Toolbar shows the current Option and lets a person choose another. The page reloads after `apply` unless `reload: false`. The current Option goes in the Debug bundle. See ADR 0002.

**Blocked by:** 01 (write gate)

**Status:** resolved

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [x] A person can pick an Option; `apply` runs and the page reloads unless `reload: false`
- [x] `current` drives what the Toolbar shows as selected
- [x] `options` may be a function; two instances (two Axes) work side by side
- [x] Each Option has an id, a label and an optional description
- [x] The current Option appears in the Debug bundle
- [x] The apply Agent tool is a write tool, off until `agent: { write: true }`
- [x] Not part of `defaultPlugins()`; tests and a docs section with an example
