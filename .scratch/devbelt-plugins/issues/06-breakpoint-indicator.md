# 06: Breakpoint indicator

**What to build:** An opt-in built-in Plugin that shows the current breakpoint and width in the Toolbar and the Debug bundle. Breakpoints are declared by the app and default to Tailwind v4's (sm 40rem, md 48rem, lg 64rem, xl 80rem, 2xl 96rem). When the viewport Plugin's Frame is active, it reports the Frame's width, not the window's.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Spec: `docs/specs/README.md`; see ADR 0003 for the write gate and the Glossary for vocabulary.

- [ ] The Toolbar shows e.g. `md · 812px` and updates on resize
- [ ] The app can declare its own breakpoints
- [ ] Inside the Frame, the Frame's width and breakpoint are shown
- [ ] Current breakpoint and width appear in the Debug bundle
- [ ] Not part of `defaultPlugins()`; tests and a docs section
