# 12: Switcher: async options, current and reload

**What to build:** `options` and `current` may be async or return null; an unknown current id shows as Unknown with its id; `reload` may be a function; the reload targets the active Frame when one is open.

**Blocked by:** 11

**Status:** wontfix

Spec: `docs/specs/switcher.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [x] Async `options` shows a loading row, then the list, with an error row and retry on failure
- [x] Async or null `current` is handled; unknown id shows Unknown with the id
- [x] `reload` accepts a function; reload reloads the Frame when one is active
- [x] Tests cover each case

## Comments

The Plugin was removed. It cannot work for every app without app-specific Options and `apply`.
