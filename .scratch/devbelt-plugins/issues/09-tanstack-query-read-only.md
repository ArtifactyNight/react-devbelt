# 09: TanStack Query: read-only Window

**What to build:** A Window with a compact list of queries and mutations showing key, status, fetch count and error, plus a badge for failing queries. Failed and pending queries go in the Debug bundle, and a read Agent tool returns them. It does not rebuild TanStack's own devtools.

**Blocked by:** 08 (Package-plugin scaffold)

**Status:** resolved

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [x] The Window lists queries and mutations with key, status, fetch count and error and updates live
- [x] The badge counts failing queries
- [x] Failed and pending queries appear in the Debug bundle without secrets (Redaction applies to keys/data shown)
- [x] A read Agent tool returns the same data
- [x] Tests against a real QueryClient; docs section
