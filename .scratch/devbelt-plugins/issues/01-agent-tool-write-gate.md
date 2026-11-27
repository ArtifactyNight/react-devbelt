# 01: Agent-tool write gate

**What to build:** A Plugin can declare which of its Agent tools change state. Those tools stay unavailable to browser agents (WebMCP and `window.devbelt`) until the app sets `agent: { write: true }` on that Plugin. Everything an Agent tool returns from the page is marked untrusted content. Demoable with a throwaway Plugin that has one reading tool and one writing tool.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [ ] A Plugin can mark an Agent tool as writing; unmarked tools are read-only
- [ ] Writing tools are not exposed to agents by default and appear once `agent: { write: true }` is set on that Plugin
- [ ] Data returned from the page by any Agent tool is marked untrusted
- [ ] The existing `set_viewport` tool keeps working as before (framing only, stays on)
- [ ] The plugin API stays `apiVersion: 1`, additive changes only
- [ ] Tests cover default-off, opt-in on, and the untrusted marker; the plugin docs describe the option
