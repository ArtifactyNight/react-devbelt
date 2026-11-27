---
"devbelt-plugin-tanstack-query": minor
---

`tanstackQuery(queryClient)` now shows a read-only Window of queries and mutations (key, status, fetch count, error) that updates live, a Badge counting failing queries, a Debug bundle section for failed and pending queries, and a read Agent tool. Cache data is never included in the bundle or agent output, and secret-looking values in keys are Redacted.
