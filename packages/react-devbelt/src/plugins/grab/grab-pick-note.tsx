"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";
import { Textarea } from "@ui-sdk/react/textarea";
import { MessageSquareTextIcon, Trash2Icon } from "lucide-react";

type Anchor = { getBoundingClientRect: () => DOMRect };

type Props = {
  index: number;
  note: string;
  open: boolean;
  // where the popover points: the selected element's current box
  anchor: Anchor;
  // where the numbered marker sits on screen
  markerStyle: React.CSSProperties;
  onOpenChange: (open: boolean) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
};

/**
 * The numbered marker on a selected element. It opens a popover beside the
 * element to add context for the AI: what to change, what looks wrong.
 */
export function GrabPickNote({
  index,
  note,
  open,
  anchor,
  markerStyle,
  onOpenChange,
  onNote,
  onRemove,
}: Props) {
  const label = `selection ${index}`;
  return (
    <Popover open={open} onOpenChange={(next) => onOpenChange(next)}>
      <PopoverTrigger
        data-react-grab-ignore
        aria-label={`Add context to ${label}`}
        title={note ? note : "Add context"}
        style={markerStyle}
        className="pointer-events-auto fixed z-[9999] inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-success-strong px-1.5 font-mono text-[11px] leading-none font-semibold text-fg shadow-md outline-none hover:bg-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {index}
        {note ? (
          <MessageSquareTextIcon className="size-3" aria-hidden="true" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={8}
        // after Done the next Enter copies the selection, so focus stays put
        finalFocus="none"
        data-react-grab-ignore
        className="m-0 w-72 rounded-xl border border-line bg-surface p-3 text-xs text-fg shadow-2xl"
      >
        <PopoverTitle className="mb-2 text-xs font-semibold">
          Context for {label}
        </PopoverTitle>
        <Textarea
          aria-label={`Context for ${label}`}
          placeholder="What should change here? What looks wrong?"
          value={note}
          autoResize
          onValueChange={onNote}
          onKeyDown={(event) => {
            // Enter saves; Shift+Enter makes a new line; ⌘/Ctrl+Enter is left
            // for Grab, which copies the whole selection
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.metaKey &&
              !event.ctrlKey
            ) {
              event.preventDefault();
              onOpenChange(false);
            }
          }}
          className="max-h-40 min-h-16 w-full resize-none rounded-md border border-line-strong bg-hover-subtle px-2 py-1.5 text-xs text-fg outline-none placeholder:text-fg-disabled focus-visible:outline-2 focus-visible:outline-focus"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-danger-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Trash2Icon className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="inline-flex h-7 items-center rounded-md bg-inverse px-3 font-medium text-fg-inverse hover:bg-inverse-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
