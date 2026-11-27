"use client";

import { createContext, useContext } from "react";

import type { ToolbarApi } from "../plugin";

export const ToolbarContext = createContext<ToolbarApi | null>(null);

/** The toolbar's API, from inside any plugin component. */
export function useToolbar(): ToolbarApi {
  const api = useContext(ToolbarContext);
  if (!api) {
    throw new Error("devbelt: useToolbar() must be used inside <DevBelt>.");
  }
  return api;
}
