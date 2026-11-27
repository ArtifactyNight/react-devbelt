# devbelt-plugin-tanstack-query

A [react-devbelt](../react-devbelt) Package plugin for TanStack Query v5.

> Scaffold: the plugin loads but does not show anything yet. The compact list of queries and mutations, refetch/invalidate/reset actions and Debug bundle sections are planned (see `docs/specs/tanstack-query.md`).

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
