// The framework-free half: capture, formatting and storage. No React in here.
export {
  clampLimit,
  errorResult,
  exposedAgentTools,
  markUntrusted,
  registerAgentTools,
  text,
  UNTRUSTED_META_KEY,
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
export { DEFAULT_REDACTION_PATTERN, isRedacted, redact, redactedForm } from "./redaction";
export {
  clearStorageStore,
  deleteStorageEntry,
  setStorageEntry,
  formatStorageBundleSection,
  formatStorageForAgent,
  HTTP_ONLY_NOTE,
  readStorageEntries,
  STORAGE_STORES,
  type StorageEntry,
  type StorageStore,
  type StorageViewOptions,
} from "./storage-view";
