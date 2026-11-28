import { expect, test, vi } from "vitest";

import {
  claudeCode,
  codex,
  cursor,
  defaultAiTools,
  describeAiResult,
  openInAiTool,
  type AiTool,
} from "../src/core/ai-tools";

test("each tool links to its app with the prompt filled in and encoded", () => {
  const prompt = "Fix the #login & the <form>\nplease";
  const encoded = encodeURIComponent(prompt);
  expect(cursor.link(prompt)).toBe(
    `cursor://anysphere.cursor-deeplink/prompt?text=${encoded}`,
  );
  expect(claudeCode.link(prompt)).toBe(`claude-cli://open?q=${encoded}`);
  expect(codex.link(prompt)).toBe(`codex://new?prompt=${encoded}`);
  expect(defaultAiTools.map((tool) => tool.id)).toEqual([
    "cursor",
    "claude-code",
    "codex",
  ]);
});

test("a short prompt is opened through the tool's link", async () => {
  const open = vi.fn();
  const copy = vi.fn();
  await expect(openInAiTool(cursor, "hello", { open, copy })).resolves.toBe("opened");
  expect(open).toHaveBeenCalledWith(cursor.link("hello"));
  expect(copy).not.toHaveBeenCalled();
});

test("a prompt too long for a link is copied, and the app opened empty when it can be", async () => {
  const long = "x".repeat(5_001);
  const copy = vi.fn(async () => {});

  const open = vi.fn();
  await expect(openInAiTool(claudeCode, long, { open, copy })).resolves.toBe("copied");
  expect(copy).toHaveBeenCalledWith(long);
  expect(open).toHaveBeenCalledWith("claude-cli://open");

  // Codex has no link without a prompt, so only the clipboard is used
  open.mockClear();
  await expect(openInAiTool(codex, long, { open, copy })).resolves.toBe("copied");
  expect(open).not.toHaveBeenCalled();
});

test("a long prompt that cannot be copied reports failure and opens nothing", async () => {
  const open = vi.fn();
  const copy = vi.fn(async () => {
    throw new Error("denied");
  });
  await expect(
    openInAiTool(cursor, "x".repeat(6_000), { open, copy }),
  ).resolves.toBe("failed");
  expect(open).not.toHaveBeenCalled();
});

test("an app can add a tool and set its own limit", async () => {
  const mine: AiTool = {
    id: "my-editor",
    label: "My editor",
    link: (prompt) => `my-editor://chat?p=${encodeURIComponent(prompt)}`,
    maxPrompt: 10,
  };
  const open = vi.fn();
  const copy = vi.fn(async () => {});
  await openInAiTool(mine, "short", { open, copy });
  expect(open).toHaveBeenCalledWith("my-editor://chat?p=short");
  await expect(openInAiTool(mine, "this is longer", { open, copy })).resolves.toBe("copied");
});

test("the toolbar line says what happened", () => {
  expect(describeAiResult(cursor, "opened")).toBe("Opened in Cursor");
  expect(describeAiResult(codex, "copied")).toBe("Copied · paste into Codex");
  expect(describeAiResult(codex, "failed")).toBe("Copy failed");
});
