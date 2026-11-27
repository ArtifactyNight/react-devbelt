// Start capturing before anything else runs, so the first requests and errors
// are not missed. A no-op in production.
import "react-devbelt/install";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DevBelt } from "react-devbelt";

import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <DevBelt />
  </StrictMode>,
);
