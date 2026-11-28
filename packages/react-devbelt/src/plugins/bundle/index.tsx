"use client";

import { MenuGroup, MenuGroupLabel, MenuItem } from "@ui-sdk/react/menu";
import { ClipboardListIcon } from "lucide-react";

import { text } from "../../core/agent-tools";
import { formatDebugBundle } from "../../core/debug-bundle";
import { definePlugin, type ToolbarApi } from "../../plugin";
import { useToolbar } from "../../ui/context";
import { menuItemClass, menuLabelClass } from "../../ui/more-menu";
import { MorphText } from "../../ui/morph-text";
import { createFlash, handOff } from "../ai-handoff";

const flash = createFlash();

const bundleText = (api: ToolbarApi) =>
  formatDebugBundle(
    api.debugContext(),
    undefined,
    undefined,
    undefined,
    api.debugSections(),
  );

/** "Open in Cursor / Claude Code / Codex" for the bundle, in More tools. */
function BundleMenuSection() {
  const api = useToolbar();
  return (
    <MenuGroup>
      <MenuGroupLabel className={menuLabelClass}>
        Open debug bundle in
      </MenuGroupLabel>
      {api.aiTools.map((tool) => (
        <MenuItem
          key={tool.id}
          value={`bundle:${tool.id}`}
          className={menuItemClass}
          onSelect={() => {
            void handOff(tool, bundleText(api)).then(({ line }) =>
              flash.show(line),
            );
          }}
        >
          {tool.label}
        </MenuItem>
      ))}
    </MenuGroup>
  );
}

/** What the last "open in" did, at the end of the toolbar for a few seconds. */
function BundleStatus() {
  const line = flash.use();
  return line ? (
    <span className="px-2 text-fg">
      <MorphText>{line}</MorphText>
    </span>
  ) : null;
}

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
        await navigator.clipboard.writeText(bundleText(api));
        return "Copied";
      } catch {
        return "Copy failed";
      }
    },
    MenuSection: BundleMenuSection,
    Status: BundleStatus,
    agentTools: [
      {
        name: "devbelt_get_debug_bundle",
        description:
          "Everything needed to start debugging in one Markdown document: page, viewport, console errors, failed requests and the latest requests.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        run: (_input, api) => text(bundleText(api)),
      },
    ],
  });
}
