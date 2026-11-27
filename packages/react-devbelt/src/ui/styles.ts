// Icons stay gray and brighten only when their toggle is pressed; small text
// (keys, counts) is white.
export const toolbarItemClass =
  "relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400 [&_svg]:text-neutral-400 [&_svg]:transition-colors data-pressed:[&_svg]:text-white";

export const tooltipClass =
  "m-0 flex items-center gap-2 rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg";

export const kbdClass =
  "inline-flex h-4 min-w-4 items-center justify-center rounded border border-white/25 px-1 font-sans text-[10px] leading-none text-white";

export const iconButtonClass =
  "inline-flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400";

export const chipClass =
  "inline-flex h-6 items-center gap-1 rounded-full border border-white/15 px-2.5 text-[11px] font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400 data-pressed:border-white data-pressed:bg-white data-pressed:text-neutral-950";
