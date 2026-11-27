# devbelt-plugin-tanstack-query

A [react-devbelt](../react-devbelt) Package plugin for TanStack Query v5.

A Window with Queries and Mutations tabs, a failing-query Badge, a Debug bundle section and a read Agent tool. Each query row has Refetch, Invalidate and Reset buttons. The matching Agent tools (`devbelt_refetch_tanstack_query`, `devbelt_invalidate_tanstack_query`, `devbelt_reset_tanstack_query`, taking the key as shown in the Window) are write tools: they do not exist unless you pass `tanstackQuery(client, { agent: { write: true } })`.

## Install

```bash
pnpm add devbelt-plugin-tanstack-query
```

Peer dependencies: `react-devbelt`, `@tanstack/react-query` v5 and `react` 19+.

## Use

The client is passed explicitly; the plugin never looks one up.

```tsx
import { QueryClient } from "@tanstack/react-query";
import { DevBelt } from "react-devbelt";
import { defaultPlugins } from "react-devbelt/plugins";
import { tanstackQuery } from "devbelt-plugin-tanstack-query";

const queryClient = new QueryClient();
const plugins = [...defaultPlugins(), tanstackQuery(queryClient)]; // build once, at module level

<DevBelt plugins={plugins} />;
```

See `examples/vite-app` for a working setup. Opt-in: it is not in `defaultPlugins()`.

## What you get

- **Window**: queries (key, status, observers, fetch count, last update, error) and mutations (key, status, time, error). Failed entries come first. It updates live, at most once per frame.
- **Badge and tooltip**: the number of queries in error; the tooltip adds how many are fetching.
- **Debug bundle**: a "TanStack Query" section listing failed, fetching and paused queries with key, status, failure count and error message. It never includes data or variables.
- **Agent tool** `devbelt_get_tanstack_query` (read-only): queries and mutations with `status` and `limit` filters. Never includes data.

Values stored under secret-looking names in a key (`token`, `password`, `apiKey`, ...) are Redacted to their length in every place the key is shown.

## Options

```ts
tanstackQuery(queryClient, {
  id: "tanstack-query", // give a second client its own id
  maxEntries: 300, // most rows per tab in the Window
});
```
