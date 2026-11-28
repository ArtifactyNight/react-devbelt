// Hand a prompt to an AI coding tool installed on this machine, through its
// deep link. The prompt is filled in, never sent: the person reviews it first.

export type AiTool = {
  /** Unique, lowercase, e.g. `cursor`. Also the saved choice in Grab's menu. */
  id: string;
  /** Shown on buttons and menu items, e.g. `Cursor`. */
  label: string;
  /** The link that opens the tool with `prompt` filled in. */
  link: (prompt: string) => string;
  /**
   * A link that opens the tool with no prompt, used with the clipboard when the
   * prompt is too long for `link`. Leave it out if the tool has none.
   */
  openLink?: string;
  /** Longest prompt `link` can carry, in characters. Default 5000. */
  maxPrompt?: number;
};

const DEFAULT_MAX_PROMPT = 5_000;

/** https://cursor.com/docs/reference/deeplinks */
export const cursor: AiTool = {
  id: "cursor",
  label: "Cursor",
  link: (prompt) =>
    `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(prompt)}`,
};

/**
 * https://code.claude.com/docs/en/deep-links. Works once Claude Code has run
 * an interactive session on this machine, which registers the handler.
 */
export const claudeCode: AiTool = {
  id: "claude-code",
  label: "Claude Code",
  link: (prompt) => `claude-cli://open?q=${encodeURIComponent(prompt)}`,
  openLink: "claude-cli://open",
};

/** The Codex app. `codex://new` needs a prompt, so a long one is copied instead. */
export const codex: AiTool = {
  id: "codex",
  label: "Codex",
  link: (prompt) => `codex://new?prompt=${encodeURIComponent(prompt)}`,
};

/** Cursor, Claude Code and Codex. Apps add their own, e.g. a team's editor, through `aiTools`. */
export const defaultAiTools: readonly AiTool[] = [cursor, claudeCode, codex];

/**
 * `opened`: the tool was asked to open with the prompt filled in.
 * `copied`: the prompt was too long for a link, so it is on the clipboard.
 * `failed`: the prompt was too long and could not be copied either.
 */
export type AiOpenResult = "opened" | "copied" | "failed";

export type AiOpenDeps = {
  /** Follows a deep link. Default: clicks an anchor, which hands it to the OS. */
  open?: (url: string) => void;
  /** Default: `navigator.clipboard.writeText`. */
  copy?: (text: string) => Promise<void>;
};

function followLink(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.click();
}

/** Opens `tool` with `prompt` filled in, or copies the prompt when it won't fit in a link. */
export async function openInAiTool(
  tool: AiTool,
  prompt: string,
  deps: AiOpenDeps = {},
): Promise<AiOpenResult> {
  const open = deps.open ?? followLink;
  const copy = deps.copy ?? ((value) => navigator.clipboard.writeText(value));
  if (prompt.length <= (tool.maxPrompt ?? DEFAULT_MAX_PROMPT)) {
    open(tool.link(prompt));
    return "opened";
  }
  try {
    await copy(prompt);
  } catch {
    return "failed";
  }
  if (tool.openLink) open(tool.openLink);
  return "copied";
}

/** A short line for the toolbar: "Opened in Cursor", "Copied · paste into Codex". */
export function describeAiResult(tool: AiTool, result: AiOpenResult): string {
  if (result === "opened") return `Opened in ${tool.label}`;
  if (result === "copied") return `Copied · paste into ${tool.label}`;
  return "Copy failed";
}
