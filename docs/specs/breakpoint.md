---
status: ready-for-agent
kind: Built-in plugin, opt-in
related: ../adr/0001-bundle-ui-sdk-and-render-in-a-shadow-root.md, ../../GLOSSARY.md
---

# Breakpoint & layout

## Problem Statement

Responsive bugs are hard to reason about because the page's current breakpoint is invisible: the developer sees a layout but not which rule set is active, and an assistant given a screenshot or a description has no idea either. Spotting which elements are taking space, overflowing or misaligned usually means opening a browser inspector and toggling outlines by hand. The Belt already frames the page at device sizes but does not say which breakpoint that size lands in.

## Solution

A **Breakpoint & layout** Plugin, opt-in, that shows the page's current breakpoint and width in the Toolbar and records them in the Debug bundle, plus a toggle that outlines every element on the page so layout boxes are visible. Breakpoints are declared by the app (defaulting to Tailwind v4's set) because they cannot be detected reliably from CSS. When a device Frame is active, the readout and the outline follow the Frame's page, which is the page the person is actually looking at.

## User Stories

1. As a developer, I want to add Breakpoint & layout to my Belt by name, so that it appears only when I choose it.
2. As a developer, I want the Toolbar to show the current breakpoint's name and the page width, so that I always know which responsive rules apply.
3. As a developer, I want the readout to update as I resize the window, so that I can watch the breakpoint change at the exact width.
4. As a developer, I want the readout to follow the device Frame when one is active, so that I see the breakpoint of the page I am looking at, not of the surrounding window.
5. As a developer, I want the readout to update when I rotate the Frame, switch device or enter a custom size, so that it always matches what I see.
6. As a developer, I want the collapsed Toolbar's chip to still tell me the breakpoint, so that I keep that information when the Toolbar is tucked away.
7. As an app developer, I want to declare my own breakpoints by name and minimum width, so that the readout matches my design system.
8. As an app developer, I want sensible defaults that match Tailwind v4, so that most projects need no configuration.
9. As an app developer, I want to write widths in pixels or rems, so that I can copy them from my CSS.
10. As an app developer, I want rems to mean sixteen pixels, so that the readout agrees with how browsers evaluate media queries regardless of the page's own root font size.
11. As an app developer, I want my breakpoints accepted in any order, so that I do not have to sort them.
12. As an app developer, I want a clear error at setup if a breakpoint width is not a positive length or two names collide, so that I find a mistake immediately.
13. As an app developer, I want to name the range below my smallest breakpoint, so that it reads as "base" or "xs" the way my team says it.
14. As a developer, I want a breakpoint to start at its declared minimum width, so that the behaviour matches `min-width` media queries.
15. As a developer, I want to see the breakpoint's minimum width alongside its name when I look closer, so that I can tell how far I am from the next one.
16. As a developer, I want a toggle that outlines every element on the page, so that I can see boxes, overflow and spacing problems without leaving the app.
17. As a developer, I want the outline to leave the layout unchanged, so that turning it on does not move anything.
18. As a developer, I want the outline to appear inside the device Frame when one is active, so that I debug the layout I am framing.
19. As a developer, I want the outline setting to survive a reload, so that I can reload while investigating.
20. As a developer, I want the outline to leave the Belt's own interface untouched, so that the Toolbar stays readable while the page is outlined.
21. As a developer, I want the outline to disappear completely when I switch it off or remove the Plugin, so that no styles are left behind.
22. As a developer, I want to pin or unpin the Plugin like any other, so that the readout and toggle leave the Toolbar when I do not need them.
23. As a developer, I want the toggle to have a clear accessible name and pressed state, so that I and assistive tools can tell whether the outline is on.
24. As an assistant user, I want the Debug bundle to state the current breakpoint, its minimum width and the actual width, so that a report says which responsive rules were active.
25. As an AI agent, I want to read the current breakpoint, width and whether outlining is on, so that I can interpret a layout bug in context.
26. As an AI agent, I want the declared breakpoints listed with their widths, so that I know what the names mean.
27. As a developer, I want the agent unable to change anything through this Plugin, so that it has nothing to guard.
28. As an app maintainer, I want the Plugin to cost nothing in a production build, so that adding it does not ship layout debugging code.
29. As a developer using a Frame wider than my window, I want the readout to use the Frame's own width, so that a scaled-down Frame does not report the wrong breakpoint.

## Implementation Decisions

- **Kind and opt-in.** A Built-in plugin in the main package's Plugin collection, not in the default list. No library beyond the package's own.
- **Why declared, not detected.** Tailwind v4 emits its theme variables into CSS only for those used, so reading them from CSS is unreliable. The app declares the breakpoints; the default set is Tailwind v4's: small at 40rem, medium at 48rem, large at 64rem, extra large at 80rem, 2x large at 96rem. The range below the smallest breakpoint is named "base" unless the app names it.
- **Factory and options.** A factory taking `breakpoints` (a map from name to a minimum width as a number of pixels or a string in pixels or rems), a name for the range below the smallest, and whether the outline starts on (default off). Validation happens when the Plugin is created: widths must be positive, names unique, values parseable; otherwise it throws with a message naming the offending entry. Breakpoints are sorted internally by width.
- **Active breakpoint.** The largest declared breakpoint whose minimum width is less than or equal to the measured width; below the smallest, the base range. One rem is sixteen pixels, matching how browsers evaluate media queries.
- **Measured width.** The width of the page the person is looking at: the device Frame's own inner width when a Frame is active, otherwise the top window's inner width. The Frame's width is its real width, not its scaled-down on-screen size. The readout recomputes on window resize and whenever the viewport Plugin's Frame state changes (device, rotation, custom size, load).
- **Item.** A custom Toolbar Item containing two things: a readout (breakpoint name and width) and a toggle for the outline. Because both live in the Item, pinning or unpinning the Plugin controls both. The collapsed Toolbar's chip shows the breakpoint name through the chip slot.
- **Outline.** An injected stylesheet that outlines all elements using the CSS outline property (never border, so layout does not shift). It is injected into the top document and, when a Frame is active, into the Frame's document, and re-injected when the Frame reloads. It is removed entirely when the toggle is off or the Plugin is torn down. The Belt's own interface is unaffected because it is rendered in a shadow root. The on/off state is saved with the Belt's saved settings and restored on load.
- **Debug bundle.** Contributes one header line giving the breakpoint name, its minimum width and the measured width, noting when the measurement is the Frame's.
- **Agent tools.** One read-only tool returning the current breakpoint, measured width, the declared breakpoints with widths and whether outlining is on, annotated read-only and untrusted. There is no tool that changes state, so the write opt-in of ADR 0003 does not apply to this Plugin.
- **Plugin API.** Fits `apiVersion` 1 with no core change. It reads the viewport Plugin's Frame state through the same shared state the built-in Plugins already use.

## Testing Decisions

- **What a good test looks like.** It sets the width the way a person would (resizing the window, choosing a device Frame) and asserts only what appears in the Toolbar, in the document's styles, in the Debug bundle and in Agent tool output.
- **One seam.** Render the Belt (without shadow isolation) with this Plugin and the viewport Plugin. Change the window width by setting it and dispatching a resize; choose devices with the existing number-key shortcuts or the Toolbar. Read the outline through the presence and removal of the injected stylesheet. Read the Debug bundle and Agent tool output the usual way.
- **Behaviours to cover.** Default breakpoints at and around each boundary (including exactly on a minimum width); custom breakpoints in pixels and rems with rem equal to sixteen pixels; unsorted input; invalid width and duplicate name errors; custom base name; readout following window resize; readout following the Frame's width, device change, rotation and custom size; chip shows the breakpoint when collapsed; outline toggle adds and removes the stylesheet, uses outline not border, appears in the Frame and survives a Frame reload, and is remembered across a reload; pin and unpin hides readout and toggle together; accessible name and pressed state; Debug bundle line; Agent tool output and absence of any writing tool.
- **Prior art.** The toolbar test file (viewport shortcuts and Frame assertions, rotation and custom size through Display, pinning) and the debug-bundle test.
- **Not covered by automated tests.** Whether the outline looks right and whether a real scaled Frame reports its true width, checked by hand in a browser with the example apps. jsdom does no layout.

## Out of Scope

- A grid or baseline overlay, a ruler or measuring tool, a colour picker, a font inspector and a spacing visualiser.
- Detecting breakpoints automatically from CSS or from a Tailwind configuration.
- Container query breakpoints and breakpoints defined by height or orientation.
- Highlighting individual elements on hover or reporting their sizes.
- Changing the viewport from this Plugin (the viewport Plugin owns that).
- Any Agent tool that changes state.

## Further Notes

- The outline is intentionally crude: one colour, every element. Its value is the thirty seconds it saves, not completeness; richer layout tools belong in later Plugins.
- The readout and the viewport Plugin's size label both show widths in some situations. They answer different questions (which rule set applies versus which device is simulated); keep their wording distinct.
