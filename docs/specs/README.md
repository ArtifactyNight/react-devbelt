# Specs

One file per Plugin. Each carries `status: ready-for-agent` in its header (this repo has no issue tracker yet, so the file is the ticket). Settled design decisions that shape them are in `docs/adr/`; vocabulary is in `../GLOSSARY.md`.

Written from the design interview. Every spec is tested at one seam: the Belt rendered in jsdom, observed through its DOM, its Agent tools and its Debug bundle.

| Spec | Kind | Decisions already made |
| --- | --- | --- |
| [Storage](storage.md) | built-in, opt-in | localStorage, sessionStorage and readable cookies; view, edit, delete, clear; hides its own `devbelt:*` keys; HttpOnly cookies are invisible and the UI says so; values for keys matching `/token\|secret\|password\|auth\|session\|jwt\|key/i` are Redacted (pattern configurable), and neither Agent tools nor the Debug bundle carry them; the Debug bundle gets key names and sizes only unless `includeValuesInBundle` |
| [Switcher](switcher.md) | built-in, opt-in | see ADR 0002; `switcher({ id, options, apply, current, reload? })`; page reloads after `apply` unless `reload: false` |
| [Breakpoint & layout](breakpoint.md) | built-in, opt-in | breakpoints declared by the app, defaulting to Tailwind v4's (`sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem`); v1 is the current breakpoint and width in the Toolbar and Debug bundle, plus an outline-all-elements toggle; no grid overlay, ruler or colour picker |
| [TanStack Query](tanstack-query.md) | Package plugin, opt-in | v5 only; `tanstackQuery(queryClient)`, client passed explicitly; compact list of queries and mutations (key, status, fetch count, error); actions are refetch, invalidate, reset; failed and pending queries go in the Debug bundle; does not rebuild TanStack's own devtools |

Applies to all four: opt-in (not in `defaultPlugins()`), Agent tools that write are off until `agent: { write: true }` (ADR 0003), every Plugin contributes to the Debug bundle without secrets, and the plugin API stays `apiVersion: 1` with additive changes only.

Deferred to their own specs: Network mock and throttle (needs an interceptor API in core first), and the backlog of A11y audit, Web vitals, i18n missing keys and Next.js info.
