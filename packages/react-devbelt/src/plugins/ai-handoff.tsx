"use client";

import { useSyncExternalStore } from "react";
import { SparklesIcon } from "lucide-react";

import {
  describeAiResult,
  openInAiTool,
  type AiOpenResult,
  type AiTool,
} from "../core/ai-tools";
import { ClaudeCodeLogo, CodexLogo, CursorLogo } from "./ai-tool-icons";

const FLASH_MS = 3_000;

const AI_TOOL_ICONS = {
  cursor: CursorLogo,
  "claude-code": ClaudeCodeLogo,
  codex: CodexLogo,
} as const;

/** The logo of a built-in AI tool for a menu; a tool the app adds gets a generic icon. */
export function AiToolIcon({ id, className }: { id: string; className?: string }) {
  const Icon = AI_TOOL_ICONS[id as keyof typeof AI_TOOL_ICONS] ?? SparklesIcon;
  return <Icon className={className} />;
}

/** Opens `tool` with `prompt` and returns the line to show the person. */
export async function handOff(
  tool: AiTool,
  prompt: string,
): Promise<{ result: AiOpenResult; line: string }> {
  const result = await openInAiTool(tool, prompt);
  return { result, line: describeAiResult(tool, result) };
}

/** A line that shows for a few seconds, e.g. at the end of the toolbar. */
export function createFlash() {
  let line: string | null = null;
  let timer: number | undefined;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    show(next: string) {
      window.clearTimeout(timer);
      line = next;
      emit();
      timer = window.setTimeout(() => {
        line = null;
        emit();
      }, FLASH_MS);
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => line,
        () => null,
      ),
  };
}
