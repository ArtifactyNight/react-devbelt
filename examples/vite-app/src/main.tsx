// Start capturing before anything else runs, so the first requests and errors
// are not missed. A no-op in production.
import "react-devbelt/install";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { DevBelt } from "react-devbelt";
import { defaultPlugins } from "react-devbelt/plugins";
import { tanstackQuery } from "devbelt-plugin-tanstack-query";

import { App } from "./app";

const queryClient = new QueryClient();
// built once at module level
const plugins = [...defaultPlugins(), tanstackQuery(queryClient)];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <DevBelt plugins={plugins} />
  </StrictMode>,
);
