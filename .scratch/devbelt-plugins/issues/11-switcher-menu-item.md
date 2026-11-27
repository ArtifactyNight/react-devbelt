# 11: Switcher: menu Item with busy and error states

**What to build:** The Switcher appears in the Toolbar as its own Item showing the Axis name and current Option; opening it lists the Options as radio entries. While `apply` runs the Item is busy and ignores further picks; if `apply` fails the failure is shown, the current Option is unchanged and retry is possible.

**Blocked by:** Review-fixes branch (`fix/devbelt-review-findings`) merged

**Status:** resolved

Spec: `docs/specs/switcher.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [x] Item shows Axis name and current Option and updates after `apply`
- [x] Picking an Option runs `apply`; further picks are ignored while busy
- [x] A failed `apply` shows a message and leaves the current Option unchanged
- [x] Pinned by default when added, per the spec
- [x] Tests cover busy, failure and success
