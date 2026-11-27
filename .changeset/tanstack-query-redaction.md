---
"devbelt-plugin-tanstack-query": patch
---

Error messages and bare string key parts (`["auth", "Bearer x"]`) are now Redacted in the Window, Debug bundle and Agent tool output. Redacted key parts carry a short fingerprint so two secrets stay distinguishable, and an Agent action on an ambiguous key refuses. The write Agent tools now work with `{ ...tanstackQuery(client), agent: { write: true } }` as well as the factory option, and an unmatched key returns an error result. Mutations without a key no longer print a placeholder, and the version check names TanStack Query v5.
