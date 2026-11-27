# 02: Redaction primitive

**What to build:** Core can hide a secret's value while keeping the fact that it exists (name and length). Values whose key matches `/token|secret|password|auth|session|jwt|key/i` are Redacted by default; the pattern is configurable. The Toolbar, Agent tools and Debug bundle all go through it, so no Plugin re-implements it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [ ] A Redaction helper decides, per key, whether a value is Redacted and returns the hidden form (name and length only)
- [ ] The default pattern matches the list above, case-insensitively
- [ ] The pattern can be overridden by the app
- [ ] Tests cover matching, non-matching, custom pattern, and that no Redacted value appears in output
- [ ] Exported from core so built-in and Package plugins can use it
