---
status: ready-for-agent
kind: Package plugin, opt-in
related: ../adr/0003-agent-tools-that-change-state-are-off-by-default.md, ../../GLOSSARY.md
---

# TanStack Query

## Problem Statement

Apps using TanStack Query rarely have trouble with the network itself; the trouble is the cache: a query that is stale when it should be fresh, a mutation that never settled, an error that a retry hid. TanStack's own devtools show this well, but they are a separate floating UI from the rest of the developer's tools, an AI assistant cannot read them, and what they know never reaches the context a developer pastes into a chat. The developer ends up describing cache state by hand.

## Solution

A **TanStack Query** Package plugin, opt-in, published as its own package so the main Belt stays free of the library. It adds a compact Window listing the app's queries and mutations with their status and errors, lets a person refetch, invalidate or reset a query, and puts failed and pending queries into the Debug bundle. It does not rebuild TanStack's devtools; its value is being in the same Toolbar as everything else, readable by agents and included in the bundle. It supports TanStack Query v5 only and is given the app's client explicitly.

## User Stories

1. As an app developer, I want to install the plugin as a separate package, so that apps without TanStack Query never carry it.
2. As an app developer, I want to add it by passing my `QueryClient`, so that it works even though the Belt is mounted outside my `QueryClientProvider`.
3. As an app developer, I want a clear error at setup if what I pass is not a TanStack Query v5 client, so that a version mismatch is obvious.
4. As an app developer, I want it to be opt-in, so that the Belt never shows it unless I add it.
5. As an app developer with two clients, I want to add the plugin once per client with a distinct id, so that each appears separately.
6. As a developer, I want a Window with a Queries tab and a Mutations tab, so that I can look at each kind of cache entry.
7. As a developer, I want each query row to show its key, its status and how many components observe it, so that I can tell what the page is using.
8. As a developer, I want status to distinguish fresh, fetching, stale, inactive, paused and error, so that I can see why a query is or is not refetching.
9. As a developer, I want each row to show how many times the query has fetched and when it last updated, so that I can spot over-fetching.
10. As a developer, I want queries in error to stand out, so that failures are the first thing I see.
11. As a developer, I want to filter the list by text and by status, so that I can find one query among many.
12. As a developer, I want to open a query to see its full key, its data and its error, so that I can inspect what the cache holds.
13. As a developer, I want large data shortened with a way to see it fully, so that one big response does not freeze the Window.
14. As a developer, I want to refetch a query from its row, so that I can retry after fixing something.
15. As a developer, I want to invalidate a query from its row, so that I can mark it stale and let the app refetch as it would in real use.
16. As a developer, I want to reset a query from its row, so that I can return it to its initial state.
17. As a developer, I want the Mutations tab to show each mutation's key (when it has one), status, variables, error and when it ran, so that I can see what the app tried to change.
18. As a developer, I want the list to update live as the cache changes, so that I never need to refresh the Window.
19. As a developer, I want rapid cache changes to cause only occasional redraws, so that a busy page does not slow down because the Window is open.
20. As a developer, I want the list capped to the most recent entries, so that a long session does not grow without bound.
21. As a developer, I want the Toolbar badge to show how many queries are in error, so that I notice failures without opening the Window.
22. As a developer, I want the badge's tooltip to also say how many queries are fetching, so that I can tell the page is still working.
23. As an assistant user, I want the Debug bundle to list failed and pending queries with key, status, failure count and error message, so that an assistant sees cache problems without me describing them.
24. As an assistant user, I want the Debug bundle to leave out query data, so that responses with personal information are not copied by accident.
25. As an AI agent, I want to read the list of queries and mutations with their status and errors, so that I can reason about cache state.
26. As an AI agent, I want to filter what I read by status and limit the count, so that I fetch only what I need.
27. As an AI agent, I want everything I read marked as untrusted page content, so that an error message or key cannot pass as an instruction.
28. As a developer, I want the agent unable to refetch, invalidate or reset unless I allow it, so that a misled agent cannot change the cache or trigger requests.
29. As a developer, I want one setting to let the agent refetch, invalidate and reset by key, so that I can enable it when I trust the setup.
30. As an app maintainer, I want the plugin to cost nothing in a production build, so that adding it does not ship cache inspection code.
31. As a Plugin author, I want this package to depend only on the Belt's public Plugin API, so that it serves as the reference for writing a Package plugin.

## Implementation Decisions

- **Kind and opt-in.** A Package plugin published as its own package, named with the Belt's Plugin naming convention for packages (`devbelt-plugin-` prefix). The main Belt does not depend on it or on TanStack Query. It declares the Belt and `@tanstack/react-query` (v5) as peer dependencies. Not part of the default list.
- **Factory and options.** A factory taking the app's `QueryClient` and options: an `id` (default identifies the plugin as the default client; supply a distinct id for a second client), a maximum number of entries shown (default a few hundred, newest first), and `agent` with a `write` flag (default false). The Plugin's id is stable for a given option set; two Plugins with the same id throw at setup.
- **Version check.** At setup the factory verifies the argument looks like a v5 client (it exposes the query and mutation caches with subscription and the v5 methods used). Otherwise it throws an error naming the expected version.
- **Subscriptions.** Subscribes to the client's query cache and mutation cache while the Plugin is installed (so the Badge stays accurate with the Window closed) and unsubscribes on teardown. Updates are batched so a burst of cache events causes at most one redraw per frame. Subscription starts at install; entries present at install are read once.
- **Window.** Two tabs, Queries and Mutations. Rows show: for queries, the key as compact text, a status, the observer count, the fetch count and the last-updated time as a relative time; for mutations, the key (if any), status, a summary of variables, error message and time. A filter field and a status filter apply to the active tab. Failed entries sort or are marked so they stand out. Selecting a row opens a detail area with the full key, the data (formatted with the Belt's JSON view, truncated to a limit with a way to expand) and the error with its stack when present.
- **Status.** Query status is derived from the cache's own fields: fetching, paused (offline), error, stale or fresh, and inactive when it has no observers, with fetching and paused taking precedence and error shown even when stale. The Window explains the colour or label of each status in a tooltip.
- **Actions.** On a query row: refetch, invalidate, reset. Each operates on that exact query by its key. There are no bulk actions, no removal, no data editing. Actions are available to the person in the UI at all times; they are not available to agents unless allowed.
- **Badge and hint.** The default window toggle's Badge shows the number of queries in error (and nothing at zero); the tooltip hint adds the number currently fetching.
- **Debug bundle.** Contributes a section "TanStack Query" listing queries that are in error or currently fetching or paused: key, status, failure count and error message (clipped). It never includes data, variables or stacks. If none qualify, the section says so briefly.
- **Agent tools.** Read: one tool listing queries and mutations, accepting a status filter and a limit (small default, hard maximum), returning Markdown with keys, statuses, fetch and failure counts and error messages, never data; annotated read-only and untrusted. Write (registered only when `agent.write` is true): refetch, invalidate and reset a query identified by its key as the exact text shown in the Window; annotated not read-only. If `agent.write` is false these tools do not exist.
- **Key identity.** A query is addressed by its key's canonical text form, the same form shown in the Window. If two queries print identically the first match wins and the Window flags the ambiguity.
- **Data privacy.** Cache data appears only in the person's own Window. It is deliberately absent from the Debug bundle and from Agent tools in v1; a later option may allow it with redaction.
- **Server rendering.** The Plugin does nothing on the server; it is a browser-only Plugin like every other.
- **Plugin API.** Fits `apiVersion` 1 with no core change, using the standard window, Badge, Hint, debug section and Agent tool fields. It is the first Plugin published outside the main package and so also validates that the Belt's public exports are sufficient for an external author, including the shared JSON view and class names.

## Testing Decisions

- **What a good test looks like.** It uses a real `QueryClient` and drives it the way an app would (running queries and mutations, forcing errors, invalidating), then asserts only what appears in the Window, the Badge, the Debug bundle text and the Agent tool output. It does not assert on subscription internals.
- **One seam.** Render the Belt (without shadow isolation) with this Plugin and a real client created in the test. Interact by role and name; call Agent tools through the global object; read the Debug bundle through the copy action or its Agent tool. Time-dependent text (relative times, batching) is driven with fake timers.
- **Behaviours to cover.** Version check error for a wrong argument; listing queries and mutations with status, observers, fetch count and time; each status label including paused; failed entries standing out; filters by text and status; opening a row with key, data and error and the truncation of large data; refetch, invalidate and reset actually changing the client's state; live updates as the cache changes, including bursts causing coalesced redraws; the entry cap; Badge count and fetching hint; Debug bundle section content with failed, fetching and paused queries and the absence of data; Agent read output with filter, limit and untrusted annotation; write tools absent by default and present with `agent.write`; two clients with distinct ids and a duplicate id error; teardown unsubscribing from both caches.
- **Prior art.** The toolbar test file (Window interactions, badges and hints, filters), the plugin-runtime test (Agent tools on the global, install and cleanup) and the debug-bundle test. The network panel's tests of list, filter and detail views are the closest analogue to the Window.
- **Not covered by automated tests.** Behaviour against every TanStack Query v5 minor version, and rendering inside the real shadow root. The package's own check against a current v5 release belongs in its CI.

## Out of Scope

- TanStack Query v4 and earlier, and the other TanStack Query adapters (Vue, Solid, Svelte, Angular) in v1.
- Rebuilding TanStack's devtools: query explorer with editable data, mutation replay, timeline, persister inspection, cache size analysis.
- Editing query data, removing queries, bulk invalidate or reset, and prefetching.
- Query data and mutation variables in the Debug bundle or in Agent tools.
- Reading the client from React context.
- Other data libraries (SWR, Apollo, RTK Query).

## Further Notes

- Using this Plugin in an app means importing the package in development only, behind the same production check the Belt documents, so it is not shipped.
- The decision to leave data out of agent-facing output is conservative on purpose: cache data is the most likely place for personal information. Revisit with Redaction once Storage's shared matcher has seen real use.
- The Plugin id and naming convention for Package plugins set here are the pattern later Package plugins (an accessibility audit, Next.js info) should follow.
