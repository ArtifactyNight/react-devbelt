# 15: TanStack Query: filters, row detail and duplicate-id check

**What to build:** The Window gets a text filter and a status filter on the active tab, a row detail area with the full key, the data (Belt JSON view, truncated with expand) and the error with its stack, failed rows clearly marked, mutation variables summarised, an ambiguity flag when two queries share the same key text, and a clear error when two clients use the same id.

**Blocked by:** Review-fixes branch (`fix/devbelt-review-findings`) merged

**Status:** resolved

Spec: `docs/specs/tanstack-query.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [x] Text and status filters narrow the active tab
- [x] Row detail shows key, truncated data and error with stack; Redaction still applies
- [x] Failed rows are marked, not only sorted; mutation variables are summarised
- [x] Duplicate key text is flagged; a duplicate Plugin id throws a clear error
- [x] Tests cover filters, detail, truncation, ambiguity and duplicate id
