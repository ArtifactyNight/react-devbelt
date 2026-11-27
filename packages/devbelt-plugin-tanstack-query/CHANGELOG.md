# devbelt-plugin-tanstack-query

## 0.1.0

### Minor Changes

- d80996a: Each query row in the TanStack Query Window now has Refetch, Invalidate and Reset buttons. The matching Agent tools (`devbelt_refetch_tanstack_query`, `devbelt_invalidate_tanstack_query`, `devbelt_reset_tanstack_query`) take a query key as shown in the Window and are write tools: they do not exist unless `agent: { write: true }` is set.
- b9457e6: The TanStack Query Window can filter the active tab by text and status. Selecting a row shows its full key, data (or mutation variables) in the JSON view, shortened until expanded, and the error with its stack. Failed rows are marked, mutation variables are summarised, and two queries that print as the same key are flagged. Creating two plugins with the same id throws.
- d80996a: New Package plugin `devbelt-plugin-tanstack-query`: `tanstackQuery(queryClient)` for TanStack Query v5. This first release is an empty scaffold that loads without errors; the queries window and actions follow.
- d80996a: `tanstackQuery(queryClient)` now shows a read-only Window of queries and mutations (key, status, fetch count, error) that updates live, a Badge counting failing queries, a Debug bundle section for failed and pending queries, and a read Agent tool. Cache data is never included in the bundle or agent output, and secret-looking values in keys are Redacted.

### Patch Changes

- d80996a: Error messages and bare string key parts (`["auth", "Bearer x"]`) are now Redacted in the Window, Debug bundle and Agent tool output. Redacted key parts carry a short fingerprint so two secrets stay distinguishable, and an Agent action on an ambiguous key refuses. The write Agent tools now work with `{ ...tanstackQuery(client), agent: { write: true } }` as well as the factory option, and an unmatched key returns an error result. Mutations without a key no longer print a placeholder, and the version check names TanStack Query v5.
- d80996a: The TanStack Query Window and Badge now use the Plugin's own `styles` and the shared `react-devbelt/ui` classes, so they no longer rely on Tailwind classes missing from the compiled stylesheet or on hardcoded colours.
- Updated dependencies [d80996a]
- Updated dependencies [d80996a]
- Updated dependencies [b0320a8]
- Updated dependencies [d80996a]
- Updated dependencies [d80996a]
- Updated dependencies [d80996a]
- Updated dependencies [e033c67]
- Updated dependencies [b9189a4]
- Updated dependencies [d80996a]
- Updated dependencies [77c10fd]
- Updated dependencies [d80996a]
- Updated dependencies [a0b7747]
- Updated dependencies [d80996a]
- Updated dependencies [d80996a]
- Updated dependencies [734db1e]
  - react-devbelt@0.1.0
