# 08: Package-plugin scaffold: devbelt-plugin-tanstack-query

**What to build:** A new workspace package that ships as its own npm package, with TanStack Query v5 and `react-devbelt` as peer dependencies. It exports `tanstackQuery(queryClient)`, which returns an empty Plugin. This also proves a Package plugin can be built purely on the public Plugin API; any gap found becomes a core ticket.

**Blocked by:** None (can start immediately)

**Status:** resolved

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [x] The package builds, type-checks, tests and lints through the repo's existing scripts
- [x] Peer dependencies are declared; the client is passed explicitly
- [x] A changeset, README and example usage exist; CI and release cover the new package
- [x] An example app can add `tanstackQuery(queryClient)` and the Plugin loads without errors
- [x] No private core imports are needed; any missing public API is recorded
