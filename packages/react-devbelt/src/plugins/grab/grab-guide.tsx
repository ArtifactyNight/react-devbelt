"use client";

import { Button } from "@ui-sdk/react/button";
import { CrosshairIcon, InfoIcon } from "lucide-react";

import { readString, writeString } from "../../core/storage";
import { kbdClass } from "../../ui/styles";

const STORAGE_KEY = "grab-guide-dismissed";

export function readGuideDismissed(): boolean {
  return readString(STORAGE_KEY) === "1";
}

export function writeGuideDismissed() {
  writeString(STORAGE_KEY, "1");
}

const MOD = "⌘/Ctrl";

const STEPS: { keys: string[]; text: string }[] = [
  { keys: ["Click"], text: "Copy the element under the cursor" },
  { keys: ["Drag"], text: "Copy everything inside a rectangle" },
  {
    keys: [MOD, "Click"],
    text: "Select several elements. Each one gets a note for your AI",
  },
  { keys: ["Enter"], text: "Copy the selection" },
  { keys: ["Esc"], text: "Cancel" },
];

const cardClass =
  "pointer-events-auto fixed inset-x-0 top-4 z-[10000] mx-auto text-xs text-fg shadow-2xl";

/**
 * How Grab works, shown when the mode starts. The first time it is a card
 * with every gesture; once dismissed it shrinks to a one-line reminder that
 * can be opened again.
 */
export function GrabGuide({
  expanded,
  onDismiss,
  onExpand,
}: {
  expanded: boolean;
  onDismiss: () => void;
  onExpand: () => void;
}) {
  if (!expanded) {
    return (
      <div
        data-react-grab-ignore
        role="note"
        aria-label="How Grab works"
        className={`${cardClass} flex w-fit items-center gap-2 rounded-full border border-line bg-surface py-1 ps-3.5 pe-1`}
      >
        <CrosshairIcon className="size-3.5 text-accent-fg" aria-hidden="true" />
        <span>Click to copy</span>
        <span className="text-fg-disabled" aria-hidden="true">
          ·
        </span>
        <span>Drag for a region</span>
        <span className="text-fg-disabled" aria-hidden="true">
          ·
        </span>
        <span>{MOD}+click for several</span>
        <span className="text-fg-disabled" aria-hidden="true">
          ·
        </span>
        <span>Esc cancels</span>
        <Button
          aria-label="Show how Grab works"
          onClick={onExpand}
          className="inline-flex size-6 items-center justify-center rounded-full text-fg-icon hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          <InfoIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div
      data-react-grab-ignore
      role="note"
      aria-label="How Grab works"
      className={`${cardClass} w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-3`}
    >
      <div className="mb-2 flex items-center gap-2">
        <CrosshairIcon className="size-4 text-accent-fg" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Grab: copy UI for your AI</h2>
      </div>
      <ul className="space-y-1.5">
        {STEPS.map((step) => (
          <li key={step.keys.join("+")} className="flex items-start gap-2">
            <span className="flex w-28 shrink-0 flex-wrap items-center gap-1">
              {step.keys.map((key, i) => (
                <span key={key} className="flex items-center gap-1">
                  {i > 0 ? (
                    <span className="text-fg-disabled" aria-hidden="true">
                      +
                    </span>
                  ) : null}
                  <kbd className={kbdClass}>{key}</kbd>
                </span>
              ))}
            </span>
            <span className="text-fg-secondary">{step.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-fg-tertiary">Press G to turn Grab on or off.</span>
        <Button
          onClick={onDismiss}
          className="inline-flex h-7 items-center rounded-md bg-inverse px-3 font-medium text-fg-inverse hover:bg-inverse-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
