"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MenuGroup, MenuGroupLabel, MenuItem } from "@ui-sdk/react/menu";
import { ToolbarButton } from "@ui-sdk/react/toolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import { CameraIcon, CircleIcon, SquareIcon } from "lucide-react";

import { definePlugin } from "../../plugin";
import { menuItemClass, menuLabelClass } from "../../ui/more-menu";
import { toolbarItemClass, tooltipClass } from "../../ui/styles";
import { createFlash } from "../ai-handoff";
import { canRecord, startRecording, videoExtension, type ActiveRecording } from "./recorder";
import {
  captureTarget,
  copyImage,
  fileName,
  saveFile,
  takeScreenshot,
} from "./screenshot";

export type CaptureOptions = {
  /** Pixel ratio of screenshots. Default: the screen's, e.g. 2 on a retina display. */
  scale?: number;
};

const flash = createFlash();

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

async function screenshot(mode: "copy" | "download", fullPage: boolean, scale?: number) {
  try {
    const shot = await takeScreenshot({ fullPage, scale });
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

async function toggleRecording() {
  if (recording) return recording.active.stop();
  if (starting) return;
  starting = true;
  try {
    const active = await startRecording();
    setRecording({ startedAt: Date.now(), active });
    void active.done.then((blob) => {
      setRecording(null);
      saveFile(blob, fileName("recording", captureTarget().label, videoExtension(blob)));
      flash.show("Recording saved");
    });
  } catch (error) {
    // the person closed the browser's prompt
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
  return <span className="tabular-nums">{clock(now - since)}</span>;
}

function makeItem(scale: number | undefined) {
  return function CaptureItem() {
    const current = useRecording();
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
        {canRecord() ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolbarButton
                  aria-label={current ? "Stop recording" : "Record screen"}
                  aria-pressed={current !== null}
                  onClick={() => void toggleRecording()}
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
        {line ? <span className="px-2 text-fg">{line}</span> : null}
      </>
    );
  };
}

function makeMenuSection(scale: number | undefined) {
  return function CaptureMenuSection() {
    const current = useRecording();
    return (
      <MenuGroup>
        <MenuGroupLabel className={menuLabelClass}>Capture</MenuGroupLabel>
        <MenuItem
          value="capture:copy"
          className={menuItemClass}
          onSelect={() => void screenshot("copy", false, scale)}
        >
          Copy screenshot
        </MenuItem>
        <MenuItem
          value="capture:save"
          className={menuItemClass}
          onSelect={() => void screenshot("download", false, scale)}
        >
          Save screenshot
        </MenuItem>
        <MenuItem
          value="capture:full"
          className={menuItemClass}
          onSelect={() => void screenshot("download", true, scale)}
        >
          Save full-page screenshot
        </MenuItem>
        {canRecord() ? (
          <MenuItem
            value="capture:record"
            className={menuItemClass}
            onSelect={() => void toggleRecording()}
          >
            {current ? "Stop recording" : "Record screen"}
          </MenuItem>
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
    Item: makeItem(options.scale),
    MenuSection: makeMenuSection(options.scale),
    ChipStatus: CaptureChip,
  });
}
