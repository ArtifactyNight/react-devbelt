"use client";

import { useSyncExternalStore } from "react";
import {
  MenuGroupLabel,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
} from "@ui-sdk/react/menu";
import { registerShortcut } from "@ui-sdk/core/shortcuts";
import { Toggle } from "@ui-sdk/react/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipShortcut,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { CheckIcon, CrosshairIcon } from "lucide-react";

import type { AiTool } from "../../core/ai-tools";
import { formatRecentProblems } from "../../core/debug-bundle";
import { readString, writeString } from "../../core/storage";
import { definePlugin } from "../../plugin";
import { useToolbar } from "../../ui/context";
import { MorphText } from "../../ui/morph-text";
import {
  menuIndicatorClass,
  menuItemClass,
  menuLabelClass,
} from "../../ui/more-menu";
import { kbdClass, toolbarItemClass, tooltipClass } from "../../ui/styles";
import { handOff } from "../ai-handoff";
import { presetOf, useViewportState } from "../viewport/store";
import { DevGrabPicker } from "./dev-grab-picker";

const GRAB_KEY = "g";
const GRAB_TOGGLE_EVENT = "devbelt:grab-toggle";
const RESULT_MS = 1_500;

type GrabState = { active: boolean; result: string | null };

let state: GrabState = { active: false, result: null };
const listeners = new Set<() => void>();
const SERVER: GrabState = { active: false, result: null };

const set = (next: Partial<GrabState>) => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const useGrab = () =>
  useSyncExternalStore(subscribe, () => state, () => SERVER);

/** Turns the picker on or off from anywhere. */
export function setGrabbing(active: boolean) {
  set({ active });
}

// What to do with the copied text besides copying it: an AI tool's id, or none.
const OPEN_IN_KEY = "grab-open-in";
let openIn: string | null = readString(OPEN_IN_KEY);
const openInListeners = new Set<() => void>();
const setOpenIn = (id: string | null) => {
  openIn = id;
  writeString(OPEN_IN_KEY, id);
  for (const listener of openInListeners) listener();
};
const useOpenIn = () =>
  useSyncExternalStore(
    (listener) => {
      openInListeners.add(listener);
      return () => {
        openInListeners.delete(listener);
      };
    },
    () => openIn,
    () => null,
  );

// The line that replaces "Copied" when the text was also handed to an AI tool.
let handedOff: string | null = null;

function finish(result: "copied" | "failed" | "cancelled") {
  set({ active: false });
  if (result === "cancelled") return;
  const line = result === "copied" ? (handedOff ?? "Copied") : "Copy failed";
  handedOff = null;
  set({ result: line });
  window.setTimeout(() => set({ result: null }), RESULT_MS);
}

function GrabMenuSection() {
  const { aiTools } = useToolbar();
  const chosen = useOpenIn();
  // a saved tool the app no longer offers counts as none
  const value = aiTools.some((tool) => tool.id === chosen) ? chosen! : "none";
  return (
    <MenuRadioGroup
      name="grab-open-in"
      value={value}
      onValueChange={(next) => setOpenIn(next === "none" ? null : next)}
    >
      <MenuGroupLabel className={menuLabelClass}>After grabbing</MenuGroupLabel>
      {[{ id: "none", label: "Copy only" }, ...aiTools.map(({ id, label }) => ({
        id,
        label: `Copy and open in ${label}`,
      }))].map((option) => (
        <MenuRadioItem key={option.id} value={option.id} className={menuItemClass}>
          <MenuItemIndicator keepMounted className={menuIndicatorClass}>
            <CheckIcon className="size-3.5" aria-hidden="true" />
          </MenuItemIndicator>
          {option.label}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

function GrabItem() {
  const { active, result } = useGrab();
  return (
    <Tooltip shortcut={GRAB_KEY}>
      <TooltipTrigger
        render={
          <Toggle
            aria-label="Grab element"
            pressed={active}
            onPressedChange={setGrabbing}
          />
        }
        className={`${toolbarItemClass} data-pressed:bg-accent/20 data-pressed:[&_svg]:text-accent-fg`}
      >
        <CrosshairIcon className="size-4" aria-hidden="true" />
        {result ? (
          <span>
            <MorphText>{result}</MorphText>
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className={`${tooltipClass} flex-col items-start`}
      >
        <span className="flex items-center gap-2 font-medium">
          Grab element
          <TooltipShortcut className={kbdClass} />
        </span>
        <span className="text-fg-secondary">
          Click to copy · drag for a region · ⌘/Ctrl+click for several
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function GrabOverlay() {
  const { active } = useGrab();
  const { aiTools } = useToolbar();
  const viewport = useViewportState();
  if (!active) return null;
  return (
    <DevGrabPicker
      viewportLabel={presetOf(viewport)?.label ?? "Full"}
      appendix={
        viewport.display.attachProblems ? () => formatRecentProblems() : undefined
      }
      onCopied={(copied) => {
        const tool: AiTool | undefined = aiTools.find((t) => t.id === openIn);
        if (!tool) return;
        void handOff(tool, copied).then(({ line }) => {
          handedOff = line;
        });
      }}
      onDone={finish}
    />
  );
}

/** Point at an element to copy it, its component stack and source location for an AI assistant (key G). */
export function grab() {
  return definePlugin({
    id: "grab",
    name: "Grab element",
    icon: <CrosshairIcon className="size-4" aria-hidden="true" />,
    install() {
      // G turns Grab on or off, from any frame. Plain letters never fire while someone types.
      const off = registerShortcut(GRAB_KEY, () => {
        try {
          (window.top ?? window).dispatchEvent(new CustomEvent(GRAB_TOGGLE_EVENT));
        } catch {
          window.dispatchEvent(new CustomEvent(GRAB_TOGGLE_EVENT));
        }
      });
      const onToggle = () => setGrabbing(!state.active);
      if (window.self === window.top) {
        window.addEventListener(GRAB_TOGGLE_EVENT, onToggle);
      }
      // load React Grab's instrumentation early so component stacks resolve
      void import("react-grab/primitives");
      return () => {
        off();
        window.removeEventListener(GRAB_TOGGLE_EVENT, onToggle);
      };
    },
    Item: GrabItem,
    Overlay: GrabOverlay,
    MenuSection: GrabMenuSection,
    run: () => setGrabbing(true),
  });
}
