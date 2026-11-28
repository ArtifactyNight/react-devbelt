"use client";

import { useSyncExternalStore } from "react";
import {
  BotIcon,
  MousePointer2Icon,
  SparklesIcon,
  SquareTerminalIcon,
} from "lucide-react";

import {
  describeAiResult,
  openInAiTool,
  type AiOpenResult,
  type AiTool,
} from "../core/ai-tools";

const FLASH_MS = 3_000;

const AI_TOOL_ICONS = {
  cursor: MousePointer2Icon,
  "claude-code": SquareTerminalIcon,
  codex: BotIcon,
} as const;

/** A menu icon for an AI tool; a tool the app adds gets a generic one. */
export function AiToolIcon({ id, className }: { id: string; className?: string }) {
  const Icon = AI_TOOL_ICONS[id as keyof typeof AI_TOOL_ICONS] ?? SparklesIcon;
  return <Icon className={className} aria-hidden="true" />;
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
