// WebMCP lets a browser's own agent call tools a page registers. Plugins
// describe tools here; they show up for the agent where WebMCP exists, and
// always on `window.devbelt` so a console or a script can call them. The
// API is new, so each call is guarded.

export type ToolResult = { content: { type: "text"; text: string }[] };

/**
 * `Context` is whatever the host hands every tool when it runs (the toolbar
 * passes its API), so a tool can read live state without a global.
 */
export type AgentTool<Context = void> = {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: Record<string, boolean>;
  run: (
    input: Record<string, unknown>,
    context: Context,
  ) => ToolResult | Promise<ToolResult>;
};

type ModelContext = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: object;
    annotations?: Record<string, boolean>;
    execute: (
      input: Record<string, unknown>,
    ) => Promise<ToolResult> | ToolResult;
  }) => unknown;
  unregisterTool?: (name: string) => void;
};

export const text = (value: string): ToolResult => ({
  content: [{ type: "text", text: value }],
});

export const clampLimit = (value: unknown, fallback: number) =>
  typeof value === "number" && value > 0
    ? Math.min(Math.floor(value), 100)
    : fallback;

const GLOBAL_NAME = "devbelt";

/**
 * Registers the tools with the browser's agent where WebMCP exists, and puts
 * them on `window.devbelt`. Returns a cleanup.
 */
export function registerAgentTools<Context>(
  tools: AgentTool<Context>[],
  getContext: () => Context,
): () => void {
  if (typeof window === "undefined" || tools.length === 0) return () => {};

  const callable = Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      (input: Record<string, unknown> = {}) => tool.run(input, getContext()),
    ]),
  );
  const host = window as unknown as Record<string, unknown>;
  host[GLOBAL_NAME] = { ...(host[GLOBAL_NAME] as object), ...callable };

  const modelContext = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  const registered: string[] = [];
  if (typeof modelContext?.registerTool === "function") {
    for (const tool of tools) {
      try {
        modelContext.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: async (input) => tool.run(input ?? {}, getContext()),
        });
        registered.push(tool.name);
      } catch {
        // already registered, or this browser's API differs: skip it
      }
    }
  }

  return () => {
    const current = host[GLOBAL_NAME] as Record<string, unknown> | undefined;
    if (current) {
      for (const tool of tools) delete current[tool.name];
      if (Object.keys(current).length === 0) delete host[GLOBAL_NAME];
    }
    for (const name of registered) {
      try {
        modelContext?.unregisterTool?.(name);
      } catch {
        // nothing to remove
      }
    }
  };
}
