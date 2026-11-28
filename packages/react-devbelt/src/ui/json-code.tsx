"use client";

import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";

hljs.registerLanguage("json", json);

// Highlighting a huge body would block the main thread; show it plain instead.
const MAX_HIGHLIGHT_CHARS = 200_000;

const TOKEN_CLASSES = [
  "[&_.hljs-attr]:text-syntax-key",
  "[&_.hljs-string]:text-syntax-string",
  "[&_.hljs-number]:text-syntax-number",
  "[&_.hljs-literal]:text-syntax-literal",
  "[&_.hljs-punctuation]:text-syntax-punctuation",
].join(" ");

export function JsonCode({ code }: { code: string }) {
  const html = useMemo(
    () =>
      code.length > MAX_HIGHLIGHT_CHARS
        ? null
        : hljs.highlight(code, { language: "json", ignoreIllegals: true })
            .value,
    [code],
  );
  const className = `font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-fg ${TOKEN_CLASSES}`;

  // highlight.js escapes the source, so its HTML output is safe to inject.
  return html === null ? (
    <pre className={className}>{code}</pre>
  ) : (
    <pre className={className}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
