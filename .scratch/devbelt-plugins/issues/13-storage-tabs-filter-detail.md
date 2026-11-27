# 13: Storage: tabs, filter, detail view and add entry

**What to build:** The Storage Window gets a tab per enabled store, a filter field, a detail area that shows the value in the Belt's JSON view (truncated with a way to expand) and an add-entry control. A `stores` option picks which stores are enabled.

**Blocked by:** Review-fixes branch (`fix/devbelt-review-findings`) merged

**Status:** resolved

Spec: `docs/specs/storage.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [x] One tab per enabled store; `stores` option controls which exist
- [x] Filter field narrows the active tab
- [x] Selecting a row opens a detail area with the formatted, truncated value and an expand control; Redacted values stay hidden unless revealed
- [x] An entry can be added from the Window
- [x] Tests cover tabs, filter, detail, truncation and add
