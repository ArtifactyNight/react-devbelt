# 10: TanStack Query: refetch, invalidate, reset

**What to build:** Per-query actions in the Window (refetch, invalidate, reset) and the matching Agent tools, which are write tools off until `agent: { write: true }`.

**Blocked by:** 09 (TanStack Query read-only Window), 01 (write gate)

**Status:** ready-for-agent

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [ ] Each action works from the Window and updates the list
- [ ] The Agent tools are off by default and on with `agent: { write: true }`
- [ ] Tests cover each action and the gate
