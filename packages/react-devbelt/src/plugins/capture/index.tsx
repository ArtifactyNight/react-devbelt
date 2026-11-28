"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
} from "@ui-sdk/react/menu";
import { ToolbarButton } from "@ui-sdk/react/toolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import {
  ArrowDownToLineIcon,
  CameraIcon,
  CheckIcon,
  CircleIcon,
  CopyIcon,
  CropIcon,
  DownloadIcon,
  EyeOffIcon,
  SquareIcon,
} from "lucide-react";

import { readString, writeString } from "../../core/storage";
import { definePlugin, type ToolbarApi } from "../../plugin";
import { useToolbar } from "../../ui/context";
import {
  menuIconClass,
  menuIndicatorClass,
  menuItemClass,
  menuLabelClass,
} from "../../ui/more-menu";
import { MorphText } from "../../ui/morph-text";
import { toolbarItemClass, tooltipClass } from "../../ui/styles";
import { createFlash } from "../ai-handoff";
import { canRecord, startRecording, videoExtension, type ActiveRecording } from "./recorder";
import {
  captureTarget,
  copyImage,
  fileName,
  saveFile,
  takeScreenshot,
  type Region,
} from "./screenshot";

export type CaptureOptions = {
  /** Pixel ratio of screenshots. Default: the screen's, e.g. 2 on a retina display. */
  scale?: number;
  /**
   * Hide the toolbar, its windows and popovers while the screen is recorded, so they are not in
   * the video. They come back when the recording ends. The person can change this in More tools,
   * and their choice wins. Default true.
   */
  hideWhileRecording?: boolean;
};

const flash = createFlash();

// "Hide the toolbar while recording": the person's saved choice, else the app's option.
const HIDE_KEY = "capture-hide";
let savedHide: boolean | null = (() => {
  const saved = readString(HIDE_KEY);
  return saved === null ? null : saved === "1";
})();
const hideListeners = new Set<() => void>();
const setSavedHide = (next: boolean) => {
  savedHide = next;
  writeString(HIDE_KEY, next ? "1" : "0");
  for (const listener of hideListeners) listener();
};
const useSavedHide = () =>
  useSyncExternalStore(
    (listener) => {
      hideListeners.add(listener);
      return () => {
        hideListeners.delete(listener);
      };
    },
    () => savedHide,
    () => null,
  );

/** Two frames: the toolbar's removal has been committed and painted. */
const afterPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

// Recording state is shared by the toolbar item, the menu and the collapsed chip.
let recording: { startedAt: number; active: ActiveRecording } | null = null;
let starting = false;
const listeners = new Set<() => void>();
const setRecording = (next: typeof recording) => {
  recording = next;
  for (const listener of listeners) listener();
};
const useRecording = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => recording,
    () => null,
  );

// Whether the region picker is up: drag on the page to choose what to capture.
let selecting = false;
const selectingListeners = new Set<() => void>();
const setSelecting = (next: boolean) => {
  selecting = next;
  for (const listener of selectingListeners) listener();
};
const useSelecting = () =>
  useSyncExternalStore(
    (listener) => {
      selectingListeners.add(listener);
      return () => {
        selectingListeners.delete(listener);
      };
    },
    () => selecting,
    () => false,
  );

async function screenshot(
  mode: "copy" | "download",
  fullPage: boolean,
  scale?: number,
  region?: Region,
) {
  try {
    const shot = await takeScreenshot({ fullPage, scale, region });
    const name = () => fileName(fullPage ? "full-page" : "screenshot", shot.label, "png");
    if (mode === "copy") {
      if (await copyImage(shot.blob)) return flash.show("Screenshot copied");
      saveFile(shot.blob, name());
      return flash.show("Clipboard blocked · screenshot saved");
    }
    saveFile(shot.blob, name());
    flash.show("Screenshot saved");
  } catch (error) {
    console.warn("devbelt: screenshot failed", error);
    flash.show("Screenshot failed");
  }
}

async function toggleRecording(api: ToolbarApi, hideByDefault: boolean) {
  if (recording) return recording.active.stop();
  if (starting) return;
  starting = true;
  // Only what we hid is shown again: a toolbar the person had hidden stays hidden.
  let weHid = false;
  const showAgain = () => {
    if (!weHid) return;
    weHid = false;
    api.setHidden(false);
  };
  try {
    const active = await startRecording({
      // after the person has picked what to share, before the first frame
      beforeStart: async () => {
        if (!(savedHide ?? hideByDefault) || api.isHidden()) return;
        api.setHidden(true);
        weHid = true;
        await afterPaint();
      },
    });
    setRecording({ startedAt: Date.now(), active });
    void active.done.then((blob) => {
      showAgain();
      setRecording(null);
      saveFile(blob, fileName("recording", captureTarget().label, videoExtension(blob)));
      flash.show("Recording saved");
    });
  } catch (error) {
    // the person closed the browser's prompt
    showAgain();
    const refused = error instanceof DOMException && error.name === "NotAllowedError";
    flash.show(refused ? "Recording cancelled" : "Recording failed");
  } finally {
    starting = false;
  }
}

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return <MorphText className="tabular-nums">{clock(now - since)}</MorphText>;
}

type Point = { x: number; y: number };

const MIN_REGION = 8;

const boxOf = (a: Point, b: Point): Region => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** Drag on the page to pick a region; its screenshot is copied when the mouse is let go. */
function makeRegionOverlay(scale: number | undefined) {
  return function RegionOverlay() {
    const on = useSelecting();
    const { holdEscape } = useToolbar();
    const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);

    // Esc leaves the picker, and the toolbar keeps its hands off Esc meanwhile
    useEffect(() => {
      if (!on) return;
      const release = holdEscape();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setDrag(null);
          setSelecting(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => {
        release();
        window.removeEventListener("keydown", onKey);
      };
    }, [on, holdEscape]);

    if (!on) return null;
    const box = drag ? boxOf(drag.from, drag.to) : null;
    const finish = (end: Point) => {
      const area = drag ? boxOf(drag.from, end) : null;
      setDrag(null);
      setSelecting(false);
      if (area && area.width >= MIN_REGION && area.height >= MIN_REGION) {
        void screenshot("copy", false, scale, area);
      }
    };

    return (
      <>
        <div
          data-react-grab-ignore
          data-capture-region
          role="presentation"
          aria-label="Select a region to screenshot"
          className="fixed inset-0 z-[9999] cursor-crosshair touch-none select-none"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = { x: event.clientX, y: event.clientY };
            setDrag({ from: point, to: point });
          }}
          onPointerMove={(event) => {
            if (drag) setDrag({ from: drag.from, to: { x: event.clientX, y: event.clientY } });
          }}
          onPointerUp={(event) => finish({ x: event.clientX, y: event.clientY })}
          onPointerCancel={() => setDrag(null)}
        />
        {box ? (
          <div
            data-react-grab-ignore
            className="pointer-events-none fixed z-[9999] border border-dashed border-accent bg-accent/10"
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
          >
            <span className="absolute -top-6 left-0 rounded bg-accent-strong px-1.5 py-0.5 font-mono text-[11px] leading-none whitespace-nowrap text-fg">
              {Math.round(box.width)}×{Math.round(box.height)}
            </span>
          </div>
        ) : (
          <div
            data-react-grab-ignore
            className="pointer-events-none fixed inset-x-0 top-4 z-[10000] mx-auto w-fit rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-fg shadow-lg"
          >
            Drag to screenshot a region · Esc cancels
          </div>
        )}
      </>
    );
  };
}

function makeItem({ scale, hideWhileRecording = true }: CaptureOptions) {
  return function CaptureItem() {
    const api = useToolbar();
    const current = useRecording();
    const picking = useSelecting();
    const line = flash.use();
    return (
      <>
        <Tooltip>
          <TooltipTrigger
            render={
              <ToolbarButton
                aria-label="Take screenshot"
                onClick={() => void screenshot("copy", false, scale)}
              />
            }
            className={toolbarItemClass}
          >
            <CameraIcon className="size-4" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
            Copy a screenshot of the page
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <ToolbarButton
                aria-label="Screenshot a region"
                aria-pressed={picking}
                onClick={() => setSelecting(!picking)}
              />
            }
            className={`${toolbarItemClass} ${picking ? "bg-accent/20 [&_svg]:text-accent-fg" : ""}`}
          >
            <CropIcon className="size-4" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
            Drag over the page to copy a screenshot of that region
          </TooltipContent>
        </Tooltip>
        {canRecord() ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolbarButton
                  aria-label={current ? "Stop recording" : "Record screen"}
                  aria-pressed={current !== null}
                  onClick={() => void toggleRecording(api, hideWhileRecording)}
                />
              }
              className={`${toolbarItemClass} ${current ? "text-danger-fg" : ""}`}
            >
              {current ? (
                <>
                  <SquareIcon className="size-3.5 fill-current" aria-hidden="true" />
                  <Elapsed since={current.startedAt} />
                </>
              ) : (
                <CircleIcon className="size-4" aria-hidden="true" />
              )}
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
              {current ? "Stop and save the recording" : "Record the screen as a video"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {line ? (
          <span className="px-2 text-fg">
            <MorphText>{line}</MorphText>
          </span>
        ) : null}
      </>
    );
  };
}

function makeMenuSection({ scale, hideWhileRecording = true }: CaptureOptions) {
  return function CaptureMenuSection() {
    const api = useToolbar();
    const current = useRecording();
    const hide = useSavedHide() ?? hideWhileRecording;
    return (
      <MenuGroup>
        <MenuGroupLabel className={menuLabelClass}>Capture</MenuGroupLabel>
        <MenuItem
          value="capture:copy"
          className={menuItemClass}
          onSelect={() => void screenshot("copy", false, scale)}
        >
          <CopyIcon className={menuIconClass} aria-hidden="true" />
          Copy screenshot
        </MenuItem>
        <MenuItem
          value="capture:region"
          className={menuItemClass}
          onSelect={() => setSelecting(true)}
        >
          <CropIcon className={menuIconClass} aria-hidden="true" />
          Screenshot a region
        </MenuItem>
        <MenuItem
          value="capture:save"
          className={menuItemClass}
          onSelect={() => void screenshot("download", false, scale)}
        >
          <DownloadIcon className={menuIconClass} aria-hidden="true" />
          Save screenshot
        </MenuItem>
        <MenuItem
          value="capture:full"
          className={menuItemClass}
          onSelect={() => void screenshot("download", true, scale)}
        >
          <ArrowDownToLineIcon className={menuIconClass} aria-hidden="true" />
          Save full-page screenshot
        </MenuItem>
        {canRecord() ? (
          <MenuItem
            value="capture:record"
            className={menuItemClass}
            onSelect={() => void toggleRecording(api, hideWhileRecording)}
          >
            {current ? (
              <SquareIcon className={`${menuIconClass} fill-current`} aria-hidden="true" />
            ) : (
              <CircleIcon className={menuIconClass} aria-hidden="true" />
            )}
            {current ? "Stop recording" : "Record screen"}
          </MenuItem>
        ) : null}
        {canRecord() ? (
          <MenuCheckboxItem
            value="capture:hide"
            checked={hide}
            onCheckedChange={setSavedHide}
            className={menuItemClass}
          >
            <MenuItemIndicator keepMounted className={menuIndicatorClass}>
              <CheckIcon className="size-3.5" aria-hidden="true" />
            </MenuItemIndicator>
            <EyeOffIcon className={menuIconClass} aria-hidden="true" />
            Hide toolbar while recording
          </MenuCheckboxItem>
        ) : null}
      </MenuGroup>
    );
  };
}

function CaptureChip() {
  const current = useRecording();
  return current ? (
    <span className="inline-flex items-center gap-1 text-danger-fg">
      <CircleIcon className="size-2.5 fill-current" aria-hidden="true" />
      <Elapsed since={current.startedAt} />
    </span>
  ) : null;
}

/**
 * Screenshot and screen recording. The camera copies a PNG of the page (the
 * device Frame's page while one is up), rendered from the DOM with
 * modern-screenshot, without the toolbar. The circle records the screen as a
 * video through the browser's own screen sharing, which asks what to share, and
 * saves it as a .webm when stopped. Opt-in: add it by name.
 */
export function capture(options: CaptureOptions = {}) {
  return definePlugin({
    id: "capture",
    name: "Screenshot & recording",
    label: "Screenshot and recording",
    icon: <CameraIcon className="size-4" aria-hidden="true" />,
    Item: makeItem(options),
    Overlay: makeRegionOverlay(options.scale),
    MenuSection: makeMenuSection(options),
    ChipStatus: CaptureChip,
  });
}
