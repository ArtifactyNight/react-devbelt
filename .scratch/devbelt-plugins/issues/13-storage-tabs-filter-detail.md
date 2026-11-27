# 13: Storage: tabs, filter, detail view and add entry

**What to build:** The Storage Window gets a tab per enabled store, a filter field, a detail area that shows the value in the Belt's JSON view (truncated with a way to expand) and an add-entry control. A `stores` option picks which stores are enabled.

**Blocked by:** Review-fixes branch (`fix/devbelt-review-findings`) merged

**Status:** ready-for-agent

Spec: `docs/specs/storage.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [ ] One tab per enabled store; `stores` option controls which exist
- [ ] Filter field narrows the active tab
- [ ] Selecting a row opens a detail area with the formatted, truncated value and an expand control; Redacted values stay hidden unless revealed
- [ ] An entry can be added from the Window
- [ ] Tests cover tabs, filter, detail, truncation and add
