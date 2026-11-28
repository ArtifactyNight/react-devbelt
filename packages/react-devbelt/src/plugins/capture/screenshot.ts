import { getFrameDocument, getFrameElement, presetOf, getViewportState } from "../viewport/store";

/** A box in the window's own coordinates (CSS pixels, from the top left of what is on screen). */
export type Region = { x: number; y: number; width: number; height: number };

export type ShotOptions = {
  /** Only this part of the screen. It wins over `fullPage`. */
  region?: Region;
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
 * `region` as the page being captured sees it. With a device Frame up the region
 * is on screen, in the host page, so it is clipped to the Frame and undone from
 * the Frame's scale. Null when none of it is on the Frame.
 */
function regionInPage(region: Region): Region | null {
  const frame = getFrameElement();
  if (!frame || !presetOf(getViewportState())) return region;
  const box = frame.getBoundingClientRect();
  const scale = frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1;
  const left = Math.max(region.x, box.left);
  const top = Math.max(region.y, box.top);
  const right = Math.min(region.x + region.width, box.right);
  const bottom = Math.min(region.y + region.height, box.bottom);
  if (right <= left || bottom <= top) return null;
  return {
    x: (left - box.left) / scale,
    y: (top - box.top) / scale,
    width: (right - left) / scale,
    height: (bottom - top) / scale,
  };
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

  const region = options.region ? regionInPage(options.region) : null;
  if (options.region && !region) throw new Error("The region is outside the page");

  const whole = options.fullPage && !region;
  const width = Math.round(region ? region.width : whole ? root.scrollWidth : view.innerWidth);
  const height = Math.round(region ? region.height : whole ? root.scrollHeight : view.innerHeight);
  const blob = await domToBlob(
    root,
    whole
      ? { ...base, width, height }
      : {
          ...base,
          width,
          height,
          // slide the page so the part wanted (what is on screen, or the region) is at the corner
          style: {
            transform: `translate(${-(view.scrollX + (region?.x ?? 0))}px, ${-(view.scrollY + (region?.y ?? 0))}px)`,
            transformOrigin: "0 0",
          },
        },
  );
  return { blob, label: region ? `${label}-region` : label, width, height };
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
