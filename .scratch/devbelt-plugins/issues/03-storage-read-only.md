# 03: Storage: read-only Window

**What to build:** An opt-in built-in Plugin (not in the default Plugin list) with a Window that shows localStorage, sessionStorage and readable cookies. It hides its own `devbelt:*` keys and says plainly that HttpOnly cookies are invisible. Redacted values show name and length only. A read Agent tool returns the same redacted view. The Debug bundle gets key names and sizes only unless `includeValuesInBundle` is set.

**Blocked by:** 02 (Redaction primitive)

**Status:** ready-for-agent

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [ ] The Window lists entries from all three stores, grouped by store
- [ ] `devbelt:*` keys are hidden
- [ ] The UI states that HttpOnly cookies cannot be seen
- [ ] Redacted values are never rendered, returned by the Agent tool, or written to the Debug bundle
- [ ] Debug bundle lists key names and sizes; values only with `includeValuesInBundle`
- [ ] Not part of `defaultPlugins()`; added by name
- [ ] Tests for listing, hiding, redaction and bundle output; a short docs section
