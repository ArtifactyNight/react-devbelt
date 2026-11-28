// Start capturing before anything else runs, so the first requests and errors
// are not missed. A no-op in production.
import "react-devbelt/install";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DevBelt, type DevBeltPlugin, type PanelMode } from "react-devbelt";
import {
  breakpoint,
  defaultPlugins,
  display,
  storage,
} from "react-devbelt/plugins";
import { tanstackQuery } from "devbelt-plugin-tanstack-query";

import { App } from "./app";
import { appInfo } from "./app-info";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5_000 } },
});

// Bundle, Display and Breakpoint start unpinned; this app pins them so every tool is on the toolbar
const pinned = <T extends DevBeltPlugin>(plugin: T): T => ({ ...plugin, pinned: true });

// Everything the toolbar can show. Built once, at module level.
const plugins = [
  // Viewport, Grab, Network, Console, Copy debug bundle and Display (swapped for a configured one)
  ...defaultPlugins()
    .filter((plugin) => plugin.id !== "display")
    .map((plugin) => (plugin.id === "bundle" ? pinned(plugin) : plugin)),
  pinned(
    display({
      darkClass: "dark",
      locale: { cookie: "lang", options: ["en", "th"], default: "en" },
    }),
  ),
  // Tailwind v4's breakpoints are the default; `outline` starts with the element outlines on
  pinned(breakpoint({ outline: false })),
  // `agent.write` lets a browser agent edit storage; without it those tools stay off
  { ...storage({ includeValuesInBundle: true }), agent: { write: true } },
  tanstackQuery(queryClient, { agent: { write: true } }),
  // A plugin written in the app, to show the plugin API
  appInfo(),
];

// `?panel=popover` opens tools as popovers; a choice made in More tools wins over it
const panelMode: PanelMode =
  new URLSearchParams(window.location.search).get("panel") === "popover"
    ? "popover"
    : "window";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
    <DevBelt plugins={plugins} panelMode={panelMode} />
  </StrictMode>,
);
