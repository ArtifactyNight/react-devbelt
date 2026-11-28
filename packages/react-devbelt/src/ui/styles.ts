// Icons stay gray and brighten only when their toggle is pressed; small text
// (keys, counts) is white.
export const toolbarItemClass =
  "relative z-10 inline-flex h-8 items-center after:absolute after:inset-x-0 after:-inset-y-1 gap-1.5 rounded-full px-2.5 text-xs font-medium text-fg transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus [&_svg]:text-fg-icon [&_svg]:transition-colors [&_svg]:duration-75 data-pressed:[&_svg]:text-fg";

export const tooltipClass =
  "m-0 flex items-center gap-2 rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-fg shadow-lg";

export const kbdClass =
  "inline-flex h-4 min-w-4 items-center justify-center rounded border border-line-control px-1 font-sans text-[10px] leading-none text-fg";

// A text button (Clear, Add, Expand). 24px tall is the smallest target WCAG 2.5.8 allows.
export const textButtonClass =
  "inline-flex min-h-6 items-center rounded-md px-1.5 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus";

export const iconButtonClass =
  "inline-flex size-7 items-center justify-center rounded-md text-fg-icon hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus";

export const chipClass =
  "inline-flex h-6 items-center gap-1 rounded-full border border-line-strong px-2.5 text-[11px] font-medium text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus data-pressed:border-line-inverse data-pressed:bg-inverse data-pressed:text-fg-inverse";
