"use client";

import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";

hljs.registerLanguage("json", json);

// Highlighting a huge body would block the main thread; show it plain instead.
const MAX_HIGHLIGHT_CHARS = 200_000;

const TOKEN_CLASSES = [
  "[&_.hljs-attr]:text-sky-300",
  "[&_.hljs-string]:text-emerald-300",
  "[&_.hljs-number]:text-amber-300",
  "[&_.hljs-literal]:text-violet-300",
  "[&_.hljs-punctuation]:text-neutral-500",
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
  const className = `font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-white ${TOKEN_CLASSES}`;

  // highlight.js escapes the source, so its HTML output is safe to inject.
  return html === null ? (
    <pre className={className}>{code}</pre>
  ) : (
    <pre className={className}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
