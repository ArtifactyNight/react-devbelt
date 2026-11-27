---
status: ready-for-agent
kind: Built-in plugin, opt-in
related: ../adr/0003-agent-tools-that-change-state-are-off-by-default.md, ../../GLOSSARY.md
---

# Storage

## Problem Statement

When a developer debugs authentication, onboarding or any state that survives a reload, they need to see and change what the page has stored: `localStorage`, `sessionStorage` and cookies. The browser's own Application tab does this, but it lives outside the page, cannot be reached by an AI assistant, and cannot put what it finds into the context a developer hands to that assistant. Stored values also routinely hold secrets (tokens, session ids), so a tool that simply dumps them into a chat or a Debug bundle is a leak waiting to happen.

## Solution

A **Storage** Plugin, opt-in, that adds a Window listing the page's `localStorage`, `sessionStorage` and readable cookies. A person can search, add, edit, delete and clear entries. Values of keys that look secret are **Redacted**: hidden until the person reveals them one at a time, and never present in Agent tools or the Debug bundle. An agent can read what the page has stored (key names, sizes, and the values of keys that are not Redacted) and, only if the app allows it, change it. The Debug bundle gains a short Storage section with key names and sizes so an assistant understands the state of the page without seeing secrets.

## User Stories

1. As a developer, I want to add the Storage Plugin to my Belt by name, so that it appears only when I choose it.
2. As a developer, I want Storage to be absent from the default Plugin list, so that upgrading the Belt never starts showing storage contents I did not ask for.
3. As a developer, I want one Window with a tab for each store, so that I can move between `localStorage`, `sessionStorage` and cookies without opening anything else.
4. As a developer, I want each entry to show its key, its value and its length in characters, so that I can spot an unexpectedly large or empty value at a glance.
5. As a developer, I want to filter entries by text, so that I can find one key among dozens.
6. As a developer, I want long values shortened in the list and shown in full when I open an entry, so that the list stays readable.
7. As a developer, I want a value that is valid JSON to be shown formatted when I open it, so that I can read nested objects.
8. As a developer, I want to add a new entry to a store, so that I can reproduce a state without writing code.
9. As a developer, I want to edit an entry's value, so that I can try a different flag, token or setting.
10. As a developer, I want to delete one entry, so that I can test the page with that item missing.
11. As a developer, I want to clear a whole store, with a confirmation, so that I can start from a clean state without clearing by accident.
12. As a developer, I want the list to update when the page changes storage, so that I do not have to refresh the Window to see what my app just wrote.
13. As a developer, I want changes made in the framed page to appear too, so that the Frame and the top page show the same truth.
14. As a developer, I want the Belt's own entries (`devbelt:`-prefixed keys and its internal bookkeeping) hidden, so that I only see my app's data.
15. As a developer, I want values of keys that look secret hidden by default, so that I can share my screen without exposing tokens.
16. As a developer, I want to reveal a hidden value for one entry at a time, so that I can still check a token when I need to.
17. As a developer, I want a revealed value to hide again when I close the Window, so that a forgotten reveal does not linger.
18. As a developer, I want to change the pattern that decides what counts as secret, so that it fits my app's key names.
19. As a developer, I want the Window to say plainly that HttpOnly cookies cannot be seen, so that I do not conclude a cookie is missing when it is only hidden from scripts.
20. As a developer, I want to be told when a store is unavailable (blocked by the browser or the frame), so that an empty list is not mistaken for an empty store.
21. As a developer, I want editing a cookie to set it for the whole site, with a note that a cookie of the same name on another path is not touched, so that I understand what the edit did.
22. As a developer, I want my last-used store tab remembered, so that the Window opens where I left it.
23. As a developer, I want to open the Window from More tools and pin or unpin the Item like any other Plugin, so that it follows the Toolbar rules I already know.
24. As a developer, I want the Debug bundle to include a Storage section with key names and sizes per store, so that an assistant knows which state exists without the values.
25. As a developer, I want the Debug bundle to include non-secret values only if I turn that on, so that the safe behaviour is the default.
26. As a developer, I want Redacted values never to appear in the Debug bundle even when I turn values on, so that opting into values cannot leak a secret.
27. As an AI agent, I want to read the page's stored entries, so that I can understand its state while debugging.
28. As an AI agent, I want Redacted values replaced by a marker that shows only that a value exists and its length, so that I can reason about presence without receiving a secret.
29. As an AI agent, I want to filter what I read by store, by key prefix and by count, so that I fetch only what I need.
30. As an AI agent, I want everything I read marked as untrusted page content, so that stored text cannot pass as instructions.
31. As a developer, I want the agent to be unable to change storage unless I allow it, so that a misled agent cannot alter my session.
32. As a developer, I want to allow the agent to set, remove and clear entries with one option, so that I can enable hands-free reproduction when I trust the setup.
33. As an app maintainer, I want Storage's list of stores configurable, so that I can leave out cookies or sessionStorage if my app does not use them.
34. As a Plugin author, I want the matcher that decides what is secret available as a shared helper, so that my own Plugin can treat keys the same way.
35. As an app maintainer, I want Storage to cost nothing in a production build, so that adding it does not ship storage inspection code.
36. As a developer using the Belt in the Frame, I want the Window to work whether I am looking at the top page or a framed device, so that the list reflects the page I am debugging.

## Implementation Decisions

- **Kind and opt-in.** A Built-in plugin shipped in the main package's Plugin collection, not part of the default Plugin list. It needs no library beyond what the package carries. It follows ADR 0001 (rendered in the Belt's shadow root, styled with the shared Toolbar classes) and ADR 0003 (writing Agent tools are off by default).
- **Factory and options.** One factory that returns a Plugin. Options: the list of stores to show (any of local, session, cookie; default all three), `redact` (one or more patterns matched case-insensitively against the **key name only**, never the value; default matches names containing token, secret, password, auth, session, jwt or key), `includeValuesInBundle` (default false), and `agent` with a `write` flag (default false).
- **Window.** One Window, default size comparable to the Network Window, with a tab per enabled store, a filter field and the entry list. Selecting an entry opens a detail area with the full value (formatted when it parses as JSON, reusing the Belt's JSON view), edit, save, cancel and delete. An add control creates a new entry. A clear control empties the active store after a confirmation dialog. The last-used tab is remembered through the Belt's own saved settings.
- **Entry display.** Each row shows key, a value preview (truncated to a fixed short length) and the value's length in characters. Redacted rows show a masked placeholder instead of a preview, with a per-row reveal control that is local to the open Window and resets when the Window closes.
- **Redaction.** One shared matcher in the framework-free part of the package decides whether a key is Redacted. It is exported for Plugin authors. Redaction hides values from the Toolbar by default, and from Agent tools and the Debug bundle absolutely. The reveal control is the only way a Redacted value reaches the screen. Writes to a Redacted key are allowed (writing does not disclose it).
- **Hidden keys.** Keys in `localStorage` and `sessionStorage` that start with the Belt's own prefix, and the Belt's internal bookkeeping entries, never appear in the list, in Agent tools or in the Debug bundle, and cannot be edited or cleared from this Window (clearing a store leaves them in place).
- **Cookies.** Only cookies visible to script are listed. The Window states that HttpOnly cookies are invisible. Writing a cookie sets name and value with path `/` and no other attributes; the Window tells the person that a cookie of the same name on a different path is not affected and that the original's other attributes cannot be read or preserved. Deleting a cookie expires it on path `/`.
- **Change detection.** The Plugin installs, once per frame, observation that notifies the Window when storage changes: a hook on the storage write operations in that frame, the browser's cross-frame storage event, and, for cookies, either the browser's cookie change event where it exists or a short polling interval that runs only while the Window is open. Install is idempotent like every Plugin install. Changes made inside the Frame appear in the top window's Window.
- **Unavailable stores.** If reading a store throws (blocked storage), its tab shows an unavailable state with a short reason rather than an empty list. All Belt access to storage already tolerates failure; this Plugin does too.
- **Agent tools.** Read: one tool that lists entries and accepts a store, a key prefix and a limit (default small, hard maximum) and returns Markdown. Redacted values are replaced by a marker stating the value is redacted and its length. Output is annotated as read-only and untrusted. Write (registered only when the `agent.write` option is true): set an entry, remove an entry, clear a store, each annotated as not read-only. Reading back a key the agent just wrote still returns the redacted marker if the key is Redacted.
- **Debug bundle.** Contributes a "Storage" section listing, per enabled store, key names and sizes (and a total count). Values appear only when `includeValuesInBundle` is true, and never for Redacted keys. Hidden Belt keys never appear.
- **Item.** Uses the default window toggle Item (icon, accessible name "Storage", optional count badge of entries across stores is not included in v1). The Plugin's identifier is stable and lowercase.
- **Persistence.** Only the last-used tab is saved, under the Belt's saved-settings namespace. Reveal state is never saved.
- **Plugin API.** Fits the existing Plugin API (`apiVersion` 1). The only addition is the shared Redaction matcher, which is additive. No change to the Toolbar is required.

## Testing Decisions

- **What a good test looks like.** It drives the Belt the way a person or agent would and asserts only what they can observe: what the Window shows, what the Agent tools return, what the Debug bundle text contains, and what the page's real storage ends up holding. It does not assert on internal state or helper functions.
- **One seam.** Render the Belt (without shadow isolation, as the existing toolbar tests do) with the Storage Plugin and interact by accessible role and name. Agent tools are called through the global object the Belt exposes. The Debug bundle is read through the copy action or its Agent tool. No separate unit seam for the matcher.
- **Behaviours to cover.** Listing per store; filtering; add, edit, delete, clear with confirmation; live update after the page writes to storage and after a change made in a framed page; hidden Belt keys; Redaction default and custom pattern, per-row reveal, reveal reset on close; HttpOnly note and cookie edit note; unavailable store state; remembered tab; Agent read output (redacted marker, prefix, limit, untrusted annotation); write tools absent by default and present with `agent.write`; Debug bundle contents with and without `includeValuesInBundle`, and the guarantee that Redacted values never appear in any output.
- **Prior art.** The toolbar test file (menu-driven opening, pressed-state checks, window queries, agent tools called on the global), the plugin-runtime test (Agent tools through the global, install idempotence) and the debug-bundle test (asserting bundle text). jsdom provides `localStorage`, `sessionStorage` and `document.cookie`; the cookie polling interval is driven with fake timers.
- **Not covered by automated tests.** Rendering inside the real shadow root and visual layout, checked by hand with the example apps.

## Out of Scope

- IndexedDB, Cache Storage, service worker storage, and storage quota views.
- HttpOnly cookies (they cannot be read by script) and cookie attributes other than name and value.
- Import and export of storage snapshots, and saved storage presets (a Switcher covers repeatable states).
- A count badge on the Item.
- Editing from agents by default (opt-in only, per ADR 0003).
- Cross-tab live sync beyond what the browser's storage event provides.

## Further Notes

- The secret-key pattern is a heuristic. It will miss a secret stored under an innocuous name and hide a harmless value stored under a suspicious one. The Window and the README should say so, and the option exists for that reason.
- Redaction matches key names because values are unbounded and expensive to classify; matching values is a possible later refinement.
- The Debug bundle's Storage section is deliberately useful without values: key names alone often explain a bug (a missing flag, a stale session key).
