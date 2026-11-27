"use client";

import { useState } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { ToolbarButton } from "@ui-sdk/react/toolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";

import type { DevBeltPlugin, ToolbarApi } from "../plugin";
import { toolbarItemClass, tooltipClass } from "./styles";

const FLASH_MS = 1_500;

/** The toolbar item a plugin gets when it doesn't draw its own. */
export function DefaultItem({
  plugin,
  open,
  onToggle,
  api,
}: {
  plugin: DevBeltPlugin;
  open: boolean;
  onToggle: () => void;
  api: ToolbarApi;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const label = plugin.label ?? plugin.name;
  const { Badge, Hint } = plugin;

  if (plugin.window) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              aria-label={label}
              pressed={open}
              onPressedChange={onToggle}
            />
          }
          className={`${toolbarItemClass} data-pressed:bg-white/15`}
        >
          {plugin.icon}
          {Badge ? <Badge /> : null}
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
          {plugin.window.title ?? plugin.name}
          {Hint ? <Hint /> : null}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (plugin.run) {
    const run = plugin.run;
    const onClick = async () => {
      let result: void | string;
      try {
        result = await run(api);
      } catch {
        result = "Failed";
      }
      if (typeof result === "string") {
        setFlash(result);
        window.setTimeout(() => setFlash(null), FLASH_MS);
      }
    };
    return (
      <Tooltip>
        <TooltipTrigger
          render={<ToolbarButton aria-label={label} onClick={onClick} />}
          className={toolbarItemClass}
        >
          {plugin.icon}
          {flash ? <span>{flash}</span> : null}
          {Badge ? <Badge /> : null}
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
          {plugin.description ?? plugin.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
