---
"devbelt-plugin-tanstack-query": minor
---

Each query row in the TanStack Query Window now has Refetch, Invalidate and Reset buttons. The matching Agent tools (`devbelt_refetch_tanstack_query`, `devbelt_invalidate_tanstack_query`, `devbelt_reset_tanstack_query`) take a query key as shown in the Window and are write tools: they do not exist unless `agent: { write: true }` is set.
