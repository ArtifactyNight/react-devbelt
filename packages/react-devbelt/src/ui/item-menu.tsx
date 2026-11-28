"use client";

import type { ReactNode } from "react";
import {
  Menu,
  MenuContent,
  MenuContextTrigger,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
} from "@ui-sdk/react/menu";

import type { DevBeltPlugin } from "../plugin";
import {
  menuContentClass,
  menuItemClass,
  menuLabelClass,
  menuSeparatorClass,
} from "./more-menu";

type Props = {
  plugin: DevBeltPlugin;
  /** Opens the plugin's window, or runs its action. */
  onOpen: () => void;
  onUnpin: () => void;
  children: ReactNode;
};

/**
 * Right-click (or long-press, or Shift+F10) on a pinned tool: the tool's own
 * More tools section, if it has one, and the basics. The browser's own menu
 * is left alone everywhere else on the toolbar.
 */
export function ItemMenu({ plugin, onOpen, onUnpin, children }: Props) {
  const Section = plugin.MenuSection;
  return (
    <Menu>
      <MenuContextTrigger
        aria-label={`${plugin.name} options`}
        render={<span className="contents" />}
      >
        {children}
      </MenuContextTrigger>
      <MenuContent
        aria-label={`${plugin.name} options`}
        data-react-grab-ignore
        className={menuContentClass}
      >
        <MenuGroup>
          <MenuGroupLabel className={menuLabelClass}>{plugin.name}</MenuGroupLabel>
          {plugin.window || plugin.run ? (
            <MenuItem value="open" className={menuItemClass} onSelect={onOpen}>
              {plugin.window ? "Open" : "Run"}
            </MenuItem>
          ) : null}
        </MenuGroup>
        {Section ? (
          <>
            <MenuSeparator className={menuSeparatorClass} />
            <Section />
          </>
        ) : null}
        <MenuSeparator className={menuSeparatorClass} />
        <MenuItem value="unpin" className={menuItemClass} onSelect={onUnpin}>
          Unpin from toolbar
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
