import { getFrameDocument, getFrameElement, presetOf, getViewportState } from "../viewport/store";

export type ShotOptions = {
  /** The whole scrollable page, not only what is on screen. Default false. */
  fullPage?: boolean;
  /** Pixel ratio of the image. Default: the screen's. */
  scale?: number;
};

export type Shot = { blob: Blob; label: string; width: number; height: number };

/** Our own UI never goes in a screenshot. */
const keep = (node: Node) =>
  node.nodeType !== 1 ||
  !((node as Element).hasAttribute("data-react-grab-ignore") ||
    (node as Element).localName === "devbelt-root");

function pageBackground(doc: Document): string {
  const view = doc.defaultView;
  if (view) {
    for (const el of [doc.body, doc.documentElement]) {
      const color = el ? view.getComputedStyle(el).backgroundColor : "";
      if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
    }
  }
  return "#ffffff";
}

/** The page the person is looking at: the device Frame's page when one is up, else this one. */
export function captureTarget(): { doc: Document; label: string } {
  const preset = presetOf(getViewportState());
  const frameDoc = preset && getFrameElement() ? getFrameDocument() : null;
  return frameDoc
    ? { doc: frameDoc, label: preset?.id ?? "frame" }
    : { doc: document, label: "page" };
}

/**
 * A PNG of the page (or the Frame's page), without the toolbar. Rendered from the
 * DOM with modern-screenshot, so it needs no permission prompt and works with
 * the same-origin Frame. Loaded on first use.
 */
export async function takeScreenshot(options: ShotOptions = {}): Promise<Shot> {
  const { domToBlob } = await import("modern-screenshot");
  const { doc, label } = captureTarget();
  const view = doc.defaultView ?? window;
  const root = doc.documentElement;
  const scale = options.scale ?? (view.devicePixelRatio || 1);
  const base = {
    type: "image/png",
    scale,
    backgroundColor: pageBackground(doc),
    filter: keep,
  };

  const width = options.fullPage ? root.scrollWidth : view.innerWidth;
  const height = options.fullPage ? root.scrollHeight : view.innerHeight;
  const blob = await domToBlob(
    root,
    options.fullPage
      ? { ...base, width, height }
      : {
          ...base,
          width,
          height,
          // show the part of the page that is on screen
          style: {
            transform: `translate(${-view.scrollX}px, ${-view.scrollY}px)`,
            transformOrigin: "0 0",
          },
        },
  );
  return { blob, label, width, height };
}

/** Puts a PNG on the clipboard. Resolves false when the browser says no. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fileName(kind: string, label: string, ext: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `devbelt-${kind}-${label}-${stamp}.${ext}`;
}

/** Saves a blob as a file, through a download link. */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
