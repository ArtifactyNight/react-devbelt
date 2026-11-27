# 04: Storage: edit, delete, clear

**What to build:** A person can edit a value, delete an entry and clear a store from the Storage Window. The matching Agent tools are write tools, unavailable until `agent: { write: true }` is set on the Plugin.

**Blocked by:** 03 (Storage read-only Window), 01 (write gate)

**Status:** ready-for-agent

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [ ] Edit, delete and clear work for localStorage, sessionStorage and readable cookies
- [ ] Redacted values can be replaced or deleted without ever being revealed
- [ ] Clearing never touches `devbelt:*` keys
- [ ] The write Agent tools are off by default and on with `agent: { write: true }`
- [ ] Tests cover each action and the gate
