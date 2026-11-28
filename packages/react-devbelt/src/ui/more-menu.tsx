"use client";

import { Fragment } from "react";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { ToolbarButton } from "@ui-sdk/react/toolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import { CheckIcon, EllipsisIcon } from "lucide-react";

import type { DevBeltPlugin } from "../plugin";
import { toolbarItemClass, tooltipClass } from "./styles";
import type { PanelMode } from "./use-dev-layout";

type Props = {
  plugins: readonly DevBeltPlugin[];
  isPinned: (plugin: DevBeltPlugin) => boolean;
  mode: PanelMode;
  onMode: (mode: PanelMode) => void;
  onRun: (plugin: DevBeltPlugin) => void;
  onPin: (id: string, pinned: boolean) => void;
  onReset: () => void;
};

export const menuContentClass =
  "m-0 max-h-(--available-height) min-w-56 scrollbar-slim overflow-y-auto rounded-xl border border-line bg-surface p-1 text-xs text-fg shadow-2xl";
export const menuLabelClass =
  "px-2 pt-1.5 pb-1 text-[10px] tracking-wide text-fg-tertiary uppercase";
export const menuItemClass =
  "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-hover";
// kept mounted so labels line up; hidden while unchecked
export const menuIndicatorClass =
  "inline-flex size-3.5 items-center justify-center data-unchecked:invisible";
// the leading icon of a menu row
export const menuIconClass = "size-3.5 shrink-0 text-fg-icon";
export const menuSeparatorClass = "my-1 h-px bg-hover";

/**
 * Everything the toolbar can do, pinned or not. Items open or run a tool;
 * the checkboxes decide which tools the toolbar shows. Plugins add their own
 * sections through `MenuSection`.
 */
export function MoreMenu({
  plugins,
  isPinned,
  mode,
  onMode,
  onRun,
  onPin,
  onReset,
}: Props) {
  const runnable = plugins.filter((p) => p.window || p.run);

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={<ToolbarButton render={<MenuTrigger />} />}
          aria-label="More tools"
          className={toolbarItemClass}
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
          More tools
        </TooltipContent>
      </Tooltip>
      <MenuContent
        side="top"
        sideOffset={10}
        data-react-grab-ignore
        className={menuContentClass}
      >
        {runnable.length > 0 ? (
          <>
            <MenuGroup>
              <MenuGroupLabel className={menuLabelClass}>Open</MenuGroupLabel>
              {runnable.map((plugin) => (
                <MenuItem
                  key={plugin.id}
                  value={`run:${plugin.id}`}
                  className={menuItemClass}
                  onSelect={() => onRun(plugin)}
                >
                  {plugin.window?.title ?? plugin.name}
                </MenuItem>
              ))}
            </MenuGroup>
            <MenuSeparator className={menuSeparatorClass} />
          </>
        ) : null}
        {plugins.map((plugin) =>
          plugin.MenuSection ? (
            <Fragment key={plugin.id}>
              <plugin.MenuSection />
              <MenuSeparator className={menuSeparatorClass} />
            </Fragment>
          ) : null,
        )}
        <MenuRadioGroup
          value={mode}
          onValueChange={(value) => onMode(value as PanelMode)}
        >
          <MenuGroupLabel className={menuLabelClass}>Open tools as</MenuGroupLabel>
          {(["window", "popover"] as const).map((option) => (
            <MenuRadioItem
              key={option}
              value={option}
              className={menuItemClass}
            >
              <MenuItemIndicator keepMounted className={menuIndicatorClass}>
                <CheckIcon className="size-3.5" aria-hidden="true" />
              </MenuItemIndicator>
              {option === "window" ? "Window" : "Popover"}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator className={menuSeparatorClass} />
        <MenuGroup>
          <MenuGroupLabel className={menuLabelClass}>
            Pinned to toolbar
          </MenuGroupLabel>
          {plugins.map((plugin) => (
            <MenuCheckboxItem
              key={plugin.id}
              value={`pin:${plugin.id}`}
              checked={isPinned(plugin)}
              onCheckedChange={(checked) => onPin(plugin.id, checked)}
              className={menuItemClass}
            >
              <MenuItemIndicator keepMounted className={menuIndicatorClass}>
                <CheckIcon className="size-3.5" aria-hidden="true" />
              </MenuItemIndicator>
              {plugin.name}
            </MenuCheckboxItem>
          ))}
        </MenuGroup>
        <MenuSeparator className={menuSeparatorClass} />
        <MenuItem value="reset" className={menuItemClass} onSelect={onReset}>
          Reset layout
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
