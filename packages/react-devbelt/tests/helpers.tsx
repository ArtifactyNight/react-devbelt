import type { ReactNode } from "react";

import { defaultAiTools } from "../src/core/ai-tools";
import type { ToolbarApi } from "../src/plugin";
import { ToolbarContext } from "../src/ui/context";

/** A toolbar API that does nothing, for rendering one plugin component alone. */
export function stubApi(overrides: Partial<ToolbarApi> = {}): ToolbarApi {
  return {
    container: document.body,
    root: document,
    openWindow() {},
    closeWindow() {},
    toggleWindow() {},
    debugContext: () => [],
    debugSections: () => [],
    holdEscape: () => () => {},
    setHidden() {},
    isHidden: () => false,
    aiTools: defaultAiTools,
    ...overrides,
  };
}

export function StubToolbar({ children }: { children: ReactNode }) {
  return (
    <ToolbarContext.Provider value={stubApi()}>{children}</ToolbarContext.Provider>
  );
}
