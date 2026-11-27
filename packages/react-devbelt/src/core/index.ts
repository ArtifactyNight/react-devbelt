// The framework-free half: capture, formatting and storage. No React in here.
export {
  clampLimit,
  registerAgentTools,
  text,
  type AgentTool,
  type ToolResult,
} from "./agent-tools";
export {
  clearConsoleLog,
  formatConsoleForAgent,
  getConsoleEntries,
  installConsoleLog,
  subscribeConsoleLog,
  type ConsoleEntry,
  type ConsoleLevel,
} from "./console-log";
export {
  formatDebugBundle,
  formatRecentProblems,
  type DebugContext,
  type DebugEntry,
} from "./debug-bundle";
export { createHostStore } from "./host-store";
export {
  clearNetworkLog,
  DEFAULT_REDACTED_HEADERS,
  formatAsCurl,
  formatAsFetch,
  formatEntryForAgent,
  getNetworkEntries,
  installNetworkLog,
  isFailedEntry,
  replayEntry,
  subscribeNetworkLog,
  type NetworkEntry,
  type NetworkLogOptions,
} from "./network-log";
export { readJson, readString, storageKey, writeJson, writeString } from "./storage";
