"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { CheckIcon, MonitorSmartphoneIcon } from "lucide-react";

import { text } from "../../core/agent-tools";
import {
  VIEWPORT_SELECT_EVENT,
  VIEWPORTS,
} from "../../core/viewports";
import { definePlugin } from "../../plugin";
import {
  menuIndicatorClass,
  menuItemClass,
  menuLabelClass,
} from "../../ui/more-menu";
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

// A pill that slides to the pressed toggle. It measures the pressed button, so
// it follows any width the label or key adds.
function useSlidingIndicator(activeId: string) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const target = group.querySelector<HTMLElement>("[data-pressed]");
      if (target) {
        setBox({ left: target.offsetLeft, width: target.offsetWidth });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [activeId]);

  // First placement snaps; later ones slide.
  useEffect(() => {
    if (box && !animate) setAnimate(true);
  }, [box, animate]);

  return { groupRef, box, animate };
}

function ViewportItem() {
  const state = useViewportState();
  const preset = presetOf(state);
  const indicator = useSlidingIndicator(preset?.id ?? "full");

  return (
    <div ref={indicator.groupRef} className="relative flex items-center">
      {indicator.box ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 start-0 rounded-full bg-white shadow-sm ${indicator.animate ? "transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none" : ""}`}
          style={{
            width: indicator.box.width,
            transform: `translateX(${indicator.box.left}px)`,
          }}
        />
      ) : null}
      <ToggleGroup
        aria-label="Viewport"
        value={[preset?.id ?? "full"]}
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
              className={`${toolbarItemClass} px-3 duration-300 data-pressed:text-neutral-950 data-pressed:hover:bg-transparent`}
            >
              {v.label}
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
              {v.label}
              {v.width ? (
                <span className="text-white/50 tabular-nums">
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
          className="fixed inset-0 z-[9000] flex items-start justify-center overflow-hidden bg-neutral-900"
          style={{ paddingTop: FRAME_PADDING.top }}
        >
          <div
            className="overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-white/15"
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
              className="block border-0 bg-white"
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
          <div
            className={`fill-mode-forwards flex flex-col items-center gap-1 rounded-2xl bg-neutral-950/85 px-6 py-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md motion-reduce:animate-none ${hud.leaving ? "animate-out fade-out zoom-out-95 duration-200" : "animate-in fade-in zoom-in-90 duration-200"}`}
          >
            <span className="text-2xl font-semibold tracking-tight">
              {hud.label}
            </span>
            <span className="text-sm text-white/60 tabular-nums">{hud.size}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ViewportMenuSection() {
  const state = useViewportState();
  return (
    <MenuRadioGroup
      name="viewport"
      value={presetOf(state)?.id ?? "full"}
      onValueChange={selectViewport}
    >
      <MenuGroupLabel className={menuLabelClass}>Viewport</MenuGroupLabel>
      {VIEWPORTS.map((v) => (
        <MenuRadioItem key={v.id} value={v.id} className={menuItemClass}>
          <MenuItemIndicator keepMounted className={menuIndicatorClass}>
            <CheckIcon className="size-3.5" aria-hidden="true" />
          </MenuItemIndicator>
          {v.label}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

function ViewportStatus() {
  const preset = presetOf(useViewportState());
  const scale = useFrameScale(preset?.width, preset?.height);
  return preset?.width ? (
    <span className="px-2 text-white tabular-nums">
      {preset.width}×{preset.height}
      {scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}
    </span>
  ) : null;
}

function ViewportChip() {
  const preset = presetOf(useViewportState());
  return (
    <>
      <span>{preset?.label ?? "Full"}</span>
      {preset?.width ? (
        <span className="text-white/60 tabular-nums">
          {preset.width}×{preset.height}
        </span>
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
