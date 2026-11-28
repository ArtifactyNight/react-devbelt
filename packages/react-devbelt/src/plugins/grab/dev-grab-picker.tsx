"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { createPortal } from "react-dom";

import { useToolbar } from "../../ui/context";
import { getFrameDocument, getFrameElement } from "../viewport/store";
import {
  GrabGuide,
  readGuideDismissed,
  writeGuideDismissed,
} from "./grab-guide";
import { GrabPickNote } from "./grab-pick-note";
import {
  copyContent,
  getElementAtPoint,
  // already in top-level window coordinates, scaled through the viewport iframe
  getElementBounds,
  getElementContext,
  isElementGrabbable,
  type ElementBounds,
} from "react-grab/primitives";

/**
 * Dev-only custom React Grab picker built on `react-grab/primitives`.
 * Hover to highlight, click to copy the element + component stack + source
 * location for an agent, drag to copy every element in a region, Esc to cancel.
 * ⌘/Ctrl+click collects several elements instead: each gets a numbered marker
 * whose popover takes a note for the AI, and Enter (or Copy) copies them all.
 * Hit testing crosses into the same-origin viewport iframe from
 * the viewport plugin.
 */

type Hover = { element: Element; bounds: ElementBounds };
type Point = { x: number; y: number };
type Pick = {
  id: number;
  element: Element;
  note: string;
  // the popover points at the element's box as it is now, not where it was
  anchor: { getBoundingClientRect: () => DOMRect };
};

const DRAG_THRESHOLD = 6;
const SAMPLE_STEP = 16;
const MAX_REGION_ELEMENTS = 20;
const MIN_INSIDE_RATIO = 0.6;

type Props = {
  // text appended after the grabbed elements, e.g. recent errors
  appendix?: () => string;
  /** Called with the copied text, e.g. to open it in an AI tool. */
  onCopied?: (text: string) => void;
  /** Active device preset label (e.g. "Mobile"), or "Full" when unframed. */
  viewportLabel: string;
  onDone: (result: "copied" | "failed" | "cancelled") => void;
};

const toRect = (a: Point, b: Point) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

const insideRatio = (
  bounds: ElementBounds,
  rect: ReturnType<typeof toRect>,
) => {
  const w =
    Math.min(bounds.x + bounds.width, rect.x + rect.width) -
    Math.max(bounds.x, rect.x);
  const h =
    Math.min(bounds.y + bounds.height, rect.y + rect.height) -
    Math.max(bounds.y, rect.y);
  const area = bounds.width * bounds.height;
  return w > 0 && h > 0 && area > 0 ? (w * h) / area : 0;
};

/** The viewport iframe's box on screen and how far it is scaled down. */
const frameGeometry = () => {
  const frame = getFrameElement();
  if (!frame) return null;
  const box = frame.getBoundingClientRect();
  const scale = frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1;
  return { frame, box, scale: scale || 1 };
};

const grabbable = (candidate: Element) =>
  isElementGrabbable(candidate) && !candidate.closest("[data-react-grab-ignore]");

/**
 * `isElementGrabbable` only understands the host document: it rejects every
 * element of the viewport frame. A framed element is picked unless it is our
 * own UI or a document root.
 */
const grabbableInFrame = (candidate: Element) =>
  !candidate.closest("[data-react-grab-ignore]") &&
  candidate !== candidate.ownerDocument.documentElement &&
  candidate !== candidate.ownerDocument.body;

/**
 * Hit test what the viewport shows. While a device frame is up, only the
 * framed page can be picked: the host page behind it is covered, and the area
 * around the frame is not part of the page.
 */
const hitTest = (x: number, y: number): Element | null => {
  const geo = frameGeometry();
  if (!geo) return getElementAtPoint(x, y, { filter: grabbable });
  const { box, scale } = geo;
  const doc = getFrameDocument();
  if (!doc || x < box.left || x > box.right || y < box.top || y > box.bottom) {
    return null;
  }
  return (
    doc
      .elementsFromPoint((x - box.left) / scale, (y - box.top) / scale)
      .find(grabbableInFrame) ?? null
  );
};

type Highlight = { key: number; bounds: ElementBounds; label: string };

const SELECTED_FLASH_MS = 900;

const tagLabel = (element: Element, bounds: ElementBounds) =>
  `${element.tagName.toLowerCase()} · ${Math.round(bounds.width)}×${Math.round(bounds.height)}`;

function Box({
  bounds,
  label,
  tone,
}: {
  bounds: ElementBounds;
  label?: string;
  tone: "hover" | "preview" | "selected" | "picked";
}) {
  const toneClass = {
    hover: "border-2 border-accent bg-accent/15",
    preview: "border border-accent bg-accent/10",
    selected: "border-2 border-success bg-success/20",
    picked: "border-2 border-success border-dashed bg-success/10",
  }[tone];
  const labelClass =
    tone === "selected" || tone === "picked" ? "bg-success-strong" : "bg-accent-strong";
  return (
    <div
      data-react-grab-ignore
      className={`pointer-events-none fixed z-[9999] ${toneClass}`}
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        borderRadius: bounds.borderRadius,
      }}
    >
      {label ? (
        <span
          className={`absolute left-0 rounded px-1.5 py-0.5 font-mono text-[11px] leading-none whitespace-nowrap text-fg ${labelClass} ${bounds.y < 24 ? "top-1" : "-top-6"}`}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function DevGrabPicker({
  viewportLabel,
  appendix,
  onCopied,
  onDone,
}: Props) {
  const { container, holdEscape } = useToolbar();
  // Grab's own Esc cancels the pick, so the toolbar keeps its hands off Esc.
  useEffect(() => holdEscape(), [holdEscape]);
  const [hover, setHover] = useState<Hover | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [preview, setPreview] = useState<Highlight[]>([]);
  const [selected, setSelected] = useState<Highlight[] | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const nextPickId = useRef(1);
  // the first time, the guide is a full card; after "Got it" a one-line reminder
  const [guideOpen, setGuideOpen] = useState(() => !readGuideDismissed());
  const [, setTick] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // a popover or field that already used the key keeps it
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        // the first Esc closes an open note, the next one leaves Grab
        if (noteFor !== null) setNoteFor(null);
        else onDone("cancelled");
        return;
      }
      if (event.key === "Enter" && picks.length > 0) {
        const mod = event.metaKey || event.ctrlKey;
        // ⌘/Ctrl+Enter copies from anywhere, even inside a note. A bare Enter
        // copies too, unless focus is on something Enter presses, like a marker.
        const onControl =
          event.target instanceof Element &&
          event.target.closest("button, a, input, textarea, select");
        if (mod || (noteFor === null && !onControl)) {
          event.preventDefault();
          copyPicks();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // copyPicks reads the latest picks through this effect's own deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone, noteFor, picks]);

  // Selected elements can move (scroll, layout): follow them while any exist.
  useEffect(() => {
    if (picks.length === 0) return;
    let frame = 0;
    let last = "";
    const follow = () => {
      const signature = picks
        .map((p) => {
          const b = getElementBounds(p.element);
          return `${b.x},${b.y},${b.width},${b.height}`;
        })
        .join("|");
      if (signature !== last) {
        last = signature;
        setTick((t) => t + 1);
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [picks]);

  const pick = hitTest;

  const dragging =
    dragStart &&
    dragEnd &&
    Math.abs(dragEnd.x - dragStart.x) + Math.abs(dragEnd.y - dragStart.y) >=
      DRAG_THRESHOLD;

  const rect =
    dragging && dragStart && dragEnd ? toRect(dragStart, dragEnd) : null;

  /** Elements mostly inside the rect, outermost first, deduped by ancestry. */
  const collectRegion = (area: ReturnType<typeof toRect>) => {
    const found = new Set<Element>();
    for (let y = area.y; y <= area.y + area.height; y += SAMPLE_STEP) {
      for (let x = area.x; x <= area.x + area.width; x += SAMPLE_STEP) {
        const el = pick(x, y);
        if (el) found.add(el);
      }
    }
    const inside = [...found].filter(
      (el) => insideRatio(getElementBounds(el), area) >= MIN_INSIDE_RATIO,
    );
    return inside
      .filter(
        (el) => !inside.some((other) => other !== el && other.contains(el)),
      )
      .slice(0, MAX_REGION_ELEMENTS);
  };

  // Live preview of what a region drag will grab (one sample pass per frame).
  const rectKey = rect
    ? `${rect.x},${rect.y},${rect.width},${rect.height}`
    : "";
  useEffect(() => {
    if (!rect) {
      setPreview([]);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setPreview(
        collectRegion(rect).map((el, key) => {
          const bounds = getElementBounds(el);
          return { key, bounds, label: "" };
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
    // rectKey captures every rect change; collectRegion is stable in behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectKey]);

  const finish = async (
    elements: Element[],
    extra: string,
    notes?: string[],
  ) => {
    if (elements.length === 0) return onDone("cancelled");
    try {
      const contexts = await Promise.all(elements.map(getElementContext));
      // Measure from the element's own window so a framed page reports the
      // iframe's CSS viewport (what its media queries actually see).
      const view = elements[0].ownerDocument.defaultView ?? window;
      const header = `[viewport: ${viewportLabel} ${view.innerWidth}×${view.innerHeight}, dpr ${view.devicePixelRatio}${extra}]`;
      const problems = appendix?.();
      // A collected selection is numbered so each note stays with its element.
      const body = contexts
        .map((c, i) => {
          const note = notes?.[i];
          const head = notes ? `${i + 1}. ${c.snippet}` : c.snippet;
          return note
            ? `${head}\n   Context: ${note.replaceAll("\n", "\n   ")}`
            : head;
        })
        .join("\n\n");
      const text = `${header}\n${body}${problems ? `\n\n${problems}` : ""}`;
      const copied = copyContent(text);
      if (copied) onCopied?.(text);
      setSelected(
        elements.map((el, key) => {
          const bounds = getElementBounds(el);
          const name = contexts[key].componentName;
          return {
            key,
            bounds,
            label: name ? `<${name}>` : tagLabel(el, bounds),
          };
        }),
      );
      window.setTimeout(
        () => onDone(copied ? "copied" : "failed"),
        SELECTED_FLASH_MS,
      );
    } catch {
      onDone("failed");
    }
  };

  const makePick = (element: Element): Pick => ({
    id: nextPickId.current++,
    element,
    note: "",
    anchor: {
      getBoundingClientRect: () => {
        const b = getElementBounds(element);
        return new DOMRect(b.x, b.y, b.width, b.height);
      },
    },
  });

  // ⌘/Ctrl+click: add the element and ask for its context, or take it back out
  const togglePick = (element: Element) => {
    const existing = picks.find((p) => p.element === element);
    if (existing) {
      setPicks(picks.filter((p) => p !== existing));
      if (noteFor === existing.id) setNoteFor(null);
      return;
    }
    const added = makePick(element);
    setPicks([...picks, added]);
    setNoteFor(added.id);
  };

  const addPicks = (elements: Element[]) =>
    setPicks((current) => [
      ...current,
      ...elements
        .filter((el) => !current.some((p) => p.element === el))
        .map(makePick),
    ]);

  const copyPicks = (also: Element[] = []) => {
    const list = [
      ...picks,
      ...also
        .filter((el) => !picks.some((p) => p.element === el))
        .map(makePick),
    ];
    void finish(
      list.map((p) => p.element),
      `, ${list.length} elements`,
      list.map((p) => p.note.trim()),
    );
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || selected) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    setDragStart(point);
    setDragEnd(point);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (selected) return;
    if (dragStart) {
      setDragEnd({ x: event.clientX, y: event.clientY });
      setHover(null);
      return;
    }
    const element = pick(event.clientX, event.clientY);
    if (!element) return setHover(null);
    setHover((prev) =>
      prev?.element === element
        ? prev
        : { element, bounds: getElementBounds(element) },
    );
  };

  const resetDrag = () => {
    setDragStart(null);
    setDragEnd(null);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    event.preventDefault();
    const start = dragStart;
    resetDrag();
    setHover(null);
    if (!start || selected) return;
    const end = { x: event.clientX, y: event.clientY };
    const area = toRect(start, end);
    const additive = event.metaKey || event.ctrlKey;
    if (area.width + area.height < DRAG_THRESHOLD) {
      const element = pick(end.x, end.y);
      if (!element) return;
      if (additive) togglePick(element);
      else if (picks.length > 0) copyPicks([element]);
      else void finish([element], "");
      return;
    }
    const elements = collectRegion(area);
    if (additive) return addPicks(elements);
    if (picks.length > 0) return copyPicks(elements);
    void finish(
      elements,
      `, region ${Math.round(area.width)}×${Math.round(area.height)}, ${elements.length} elements`,
    );
  };

  return createPortal(
    <>
      <div
        data-react-grab-ignore
        className="fixed inset-0 z-[9999] cursor-crosshair touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={resetDrag}
      />
      {selected
        ? selected.map((h) => (
            <Box
              key={h.key}
              bounds={h.bounds}
              label={h.label}
              tone="selected"
            />
          ))
        : null}
      {!selected && rect ? (
        <>
          {preview.map((h) => (
            <Box key={h.key} bounds={h.bounds} tone="preview" />
          ))}
          <div
            data-react-grab-ignore
            className="pointer-events-none fixed z-[9999] border border-dashed border-accent bg-accent/5"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            <span className="absolute -top-6 left-0 rounded bg-accent-strong px-1.5 py-0.5 font-mono text-[11px] leading-none whitespace-nowrap text-fg">
              {preview.length} selected
            </span>
          </div>
        </>
      ) : null}
      {!selected
        ? picks.map((p, i) => {
            const bounds = getElementBounds(p.element);
            return (
              <Fragment key={p.id}>
                <Box bounds={bounds} tone="picked" />
                <GrabPickNote
                  index={i + 1}
                  note={p.note}
                  open={noteFor === p.id}
                  anchor={p.anchor}
                  markerStyle={{
                    left: Math.max(bounds.x - 6, 4),
                    top: Math.max(bounds.y - 10, 4),
                  }}
                  onOpenChange={(open) => setNoteFor(open ? p.id : null)}
                  onNote={(note) =>
                    setPicks((current) =>
                      current.map((x) => (x.id === p.id ? { ...x, note } : x)),
                    )
                  }
                  onRemove={() => {
                    setPicks((current) => current.filter((x) => x.id !== p.id));
                    setNoteFor(null);
                  }}
                />
              </Fragment>
            );
          })
        : null}
      {!selected && picks.length === 0 && !rect ? (
        <GrabGuide
          expanded={guideOpen}
          onDismiss={() => {
            writeGuideDismissed();
            setGuideOpen(false);
          }}
          onExpand={() => setGuideOpen(true)}
        />
      ) : null}
      {!selected && picks.length > 0 ? (
        <div
          data-react-grab-ignore
          className="pointer-events-auto fixed inset-x-0 top-4 z-[10000] mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-surface py-1 ps-3.5 pe-1 text-xs text-fg shadow-lg"
        >
          <span className="font-medium tabular-nums">
            {picks.length} selected
          </span>
          <span className="text-fg-secondary">
            ⌘/Ctrl+click adds · Enter copies
          </span>
          <Button
            aria-label="Copy selection"
            onClick={() => copyPicks()}
            className="inline-flex h-7 items-center rounded-full bg-inverse px-3 font-medium text-fg-inverse hover:bg-inverse-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Copy
          </Button>
          <Button
            aria-label="Cancel grab"
            onClick={() => onDone("cancelled")}
            className="inline-flex h-7 items-center rounded-full px-3 text-fg-secondary hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {!selected && hover && !rect ? (
        <Box
          bounds={hover.bounds}
          label={`${tagLabel(hover.element, hover.bounds)} · ${picks.length > 0 ? "⌘/Ctrl+click to add" : "click to copy"}`}
          tone="hover"
        />
      ) : null}
    </>,
    container,
  );
}
