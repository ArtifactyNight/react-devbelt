"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { registerShortcut } from "@ui-sdk/core/shortcuts";
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipShortcut,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import {
  MenuGroupLabel,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
} from "@ui-sdk/react/menu";
import {
  CheckIcon,
  ExpandIcon,
  LaptopIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  RulerIcon,
  SmartphoneIcon,
  TabletIcon,
  type LucideIcon,
} from "lucide-react";

import { text } from "../../core/agent-tools";
import {
  VIEWPORT_SELECT_EVENT,
  VIEWPORTS,
} from "../../core/viewports";
import { definePlugin } from "../../plugin";
import { MorphText } from "../../ui/morph-text";
import {
  menuIndicatorClass,
  menuItemClass,
  menuLabelClass,
  menuIconClass,
} from "../../ui/more-menu";
import { spring } from "../../ui/springs";
import { kbdClass, toolbarItemClass, tooltipClass } from "../../ui/styles";
import {
  frameLoaded,
  getFrameWindow,
  getViewportState,
  listenForViewportSelection,
  presetOf,
  selectViewport,
  setFrame,
  useViewportState,
} from "./store";

const FRAME_PADDING = { x: 32, top: 24, bottom: 88 };

// Shortcuts are registered in every frame and routed to the top window, so
// 1–6 still work while focus is inside the viewport iframe.
function registerShortcuts() {
  const offs = VIEWPORTS.map((v) =>
    registerShortcut(v.keys, () => selectViewport(v.id)),
  );
  return () => offs.forEach((off) => off());
}

/** How far the frame is scaled down to fit the window. */
function useFrameScale(width?: number, height?: number) {
  const [area, setArea] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  useEffect(() => {
    const update = () =>
      setArea({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width && height
    ? Math.min(
        1,
        (area.w - FRAME_PADDING.x) / width,
        (area.h - FRAME_PADDING.top - FRAME_PADDING.bottom) / height,
      )
    : 1;
}

function ViewportItem() {
  const state = useViewportState();
  const preset = presetOf(state);
  const activeId = preset?.id ?? "full";

  return (
    <div className="relative flex items-center">
      <ToggleGroup
        aria-label="Viewport"
        value={[activeId]}
        deselectable={false}
        onValueChange={([value]) => {
          if (value) selectViewport(value);
        }}
        className="flex items-center gap-0.5"
      >
        {VIEWPORTS.map((v) => (
          <Tooltip key={v.id} shortcut={v.keys}>
            <TooltipTrigger
              render={<Toggle value={v.id} />}
              className={`${toolbarItemClass} px-3 data-pressed:text-fg-inverse data-pressed:hover:bg-transparent`}
            >
              {/* one pill, shared by the toggles: it glides to the pressed one, on transforms only */}
              {v.id === activeId ? (
                <motion.span
                  layoutId="devbelt-viewport-pill"
                  aria-hidden="true"
                  transition={spring.moderate}
                  className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-inverse shadow-sm"
                />
              ) : null}
              {v.label}
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
              {v.label}
              {v.width ? (
                <span className="text-fg-tertiary tabular-nums">
                  {v.width}×{v.height}
                </span>
              ) : null}
              <TooltipShortcut className={kbdClass} />
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </div>
  );
}

function ViewportOverlay() {
  const state = useViewportState();
  const preset = presetOf(state);
  const scale = useFrameScale(preset?.width, preset?.height);
  const { hud, src } = state;

  return (
    <>
      {preset?.width && preset.height && src ? (
        <div
          className="fixed inset-0 z-[9000] flex items-start justify-center overflow-hidden bg-surface-raised"
          style={{ paddingTop: FRAME_PADDING.top }}
        >
          <div
            className="overflow-hidden rounded-xl bg-page shadow-2xl ring-1 ring-line-strong"
            style={{
              width: preset.width * scale,
              height: preset.height * scale,
            }}
          >
            <iframe
              ref={setFrame}
              onLoad={frameLoaded}
              title={`${preset.label} viewport`}
              src={src}
              className="block border-0 bg-page"
              style={{
                width: preset.width,
                height: preset.height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            />
          </div>
        </div>
      ) : null}

      {hud ? (
        <div
          key={hud.key}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[10001] grid place-items-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={
              hud.leaving
                ? { opacity: 0, scale: 0.95 }
                : { opacity: 1, scale: 1 }
            }
            transition={hud.leaving ? spring.slow.exit : spring.slow}
            className="flex flex-col items-center gap-1 rounded-2xl bg-surface-overlay px-6 py-4 text-fg shadow-2xl ring-1 ring-line backdrop-blur-md"
          >
            <span className="text-2xl font-semibold tracking-tight">
              {hud.label}
            </span>
            <span className="text-sm text-fg-secondary tabular-nums">{hud.size}</span>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}

const VIEWPORT_ICONS: Record<string, LucideIcon> = {
  full: ExpandIcon,
  mobile: SmartphoneIcon,
  ipad: TabletIcon,
  macbook: LaptopIcon,
  pc: MonitorIcon,
  custom: RulerIcon,
};

function ViewportMenuSection() {
  const state = useViewportState();
  return (
    <MenuRadioGroup
      name="viewport"
      value={presetOf(state)?.id ?? "full"}
      onValueChange={selectViewport}
    >
      <MenuGroupLabel className={menuLabelClass}>Viewport</MenuGroupLabel>
      {VIEWPORTS.map((v) => {
        const Icon = VIEWPORT_ICONS[v.id] ?? MonitorIcon;
        return (
          <MenuRadioItem key={v.id} value={v.id} className={menuItemClass}>
            <MenuItemIndicator keepMounted className={menuIndicatorClass}>
              <CheckIcon className="size-3.5" aria-hidden="true" />
            </MenuItemIndicator>
            <Icon className={menuIconClass} aria-hidden="true" />
            {v.label}
          </MenuRadioItem>
        );
      })}
    </MenuRadioGroup>
  );
}

function ViewportStatus() {
  const preset = presetOf(useViewportState());
  const scale = useFrameScale(preset?.width, preset?.height);
  return preset?.width ? (
    <span className="px-2 text-fg tabular-nums">
      <MorphText>
        {`${preset.width}×${preset.height}${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}`}
      </MorphText>
    </span>
  ) : null;
}

function ViewportChip() {
  const preset = presetOf(useViewportState());
  return (
    <>
      <MorphText>{preset?.label ?? "Full"}</MorphText>
      {preset?.width ? (
        <MorphText className="text-fg-secondary tabular-nums">
          {`${preset.width}×${preset.height}`}
        </MorphText>
      ) : null}
    </>
  );
}

/** The device frame: pick Mobile, iPad, MacBook, PC or a custom size (keys 1–6). */
export function viewport() {
  return definePlugin({
    id: "viewport",
    name: "Viewport",
    icon: <MonitorSmartphoneIcon className="size-4" aria-hidden="true" />,
    separatorAfter: true,
    install() {
      const offShortcuts = registerShortcuts();
      const offListen =
        window.self === window.top ? listenForViewportSelection() : undefined;
      return () => {
        offShortcuts();
        offListen?.();
      };
    },
    Item: ViewportItem,
    Overlay: ViewportOverlay,
    MenuSection: ViewportMenuSection,
    Status: ViewportStatus,
    ChipStatus: ViewportChip,
    debugContext() {
      const state = getViewportState();
      const preset = presetOf(state);
      let page = window.location.href;
      try {
        page = getFrameWindow()?.location.href ?? page;
      } catch {
        // cross-origin frame: keep the top page's address
      }
      return [
        { label: "Page", value: page },
        {
          label: "Viewport",
          value: preset?.width
            ? `${preset.label} ${preset.width}×${preset.height}`
            : `Full ${window.innerWidth}×${window.innerHeight}`,
        },
      ];
    },
    agentTools: [
      {
        name: "devbelt_set_viewport",
        description:
          "Frame the page at a device size to check responsive layout. Use `full` to remove the frame.",
        inputSchema: {
          type: "object",
          properties: {
            viewport: { type: "string", enum: VIEWPORTS.map((v) => v.id) },
          },
          required: ["viewport"],
        },
        // Changes only the framing of the page, so it is not gated (ADR 0003).
        annotations: { readOnlyHint: false },
        run: (input) => {
          const target = VIEWPORTS.find((v) => v.id === input.viewport);
          if (!target) {
            return text(
              `Unknown viewport. Use one of: ${VIEWPORTS.map((v) => v.id).join(", ")}.`,
            );
          }
          window.dispatchEvent(
            new CustomEvent(VIEWPORT_SELECT_EVENT, { detail: target.id }),
          );
          return text(
            `Viewport set to ${target.label}${target.width ? ` (${target.width}×${target.height})` : ""}.`,
          );
        },
      },
    ],
  });
}

export { getFrameDocument, getFrameWindow, patchDisplay, selectViewport, useViewportState, presetOf } from "./store";
