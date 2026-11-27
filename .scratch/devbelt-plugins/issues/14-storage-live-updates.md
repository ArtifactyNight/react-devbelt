# 14: Storage: live updates, Frame awareness, remembered tab

**What to build:** The Window stays current without the manual Refresh button: it reflects writes made by the page and by a framed page, remembers the last-used tab, and explains that cookies on another path are not affected by edit or clear.

**Blocked by:** 13

**Status:** resolved

Spec: `docs/specs/storage.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [x] Page and Frame writes appear without a manual refresh
- [x] The last-used tab is remembered
- [x] The cookie other-path note is shown
- [x] Tests cover live updates and the remembered tab
