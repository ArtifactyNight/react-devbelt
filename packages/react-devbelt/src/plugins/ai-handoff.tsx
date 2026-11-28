"use client";

import { useSyncExternalStore } from "react";

import {
  describeAiResult,
  openInAiTool,
  type AiOpenResult,
  type AiTool,
} from "../core/ai-tools";

const FLASH_MS = 3_000;

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
