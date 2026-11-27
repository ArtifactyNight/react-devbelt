"use client";

import { ClipboardListIcon } from "lucide-react";

import { text } from "../../core/agent-tools";
import { formatDebugBundle } from "../../core/debug-bundle";
import { definePlugin } from "../../plugin";

/** One button that copies page, viewport, errors and failed requests for an AI assistant. */
export function bundle() {
  return definePlugin({
    id: "bundle",
    name: "Copy debug bundle",
    label: "Copy debug bundle",
    description:
      "Copy page, viewport, errors and failed requests for an AI assistant",
    icon: <ClipboardListIcon className="size-4" aria-hidden="true" />,
    pinned: false,
    async run(api) {
      try {
        await navigator.clipboard.writeText(
          formatDebugBundle(
            api.debugContext(),
            undefined,
            undefined,
            undefined,
            api.debugSections(),
          ),
        );
        return "Copied";
      } catch {
        return "Copy failed";
      }
    },
    agentTools: [
      {
        name: "devbelt_get_debug_bundle",
        description:
          "Everything needed to start debugging in one Markdown document: page, viewport, console errors, failed requests and the latest requests.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        run: (_input, api) =>
          text(
            formatDebugBundle(
              api.debugContext(),
              undefined,
              undefined,
              undefined,
              api.debugSections(),
            ),
          ),
      },
    ],
  });
}
