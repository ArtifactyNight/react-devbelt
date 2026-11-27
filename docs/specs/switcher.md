---
status: wontfix
kind: Built-in plugin, opt-in
related: ../adr/0002-switcher-is-generic-one-axis-per-instance.md, ../adr/0003-agent-tools-that-change-state-are-off-by-default.md, ../../GLOSSARY.md
---

# Switcher

## Problem Statement

Apps that depend on who is signed in, which tenant is active, which role applies or which flag set is on force developers to change that context constantly: to check a screen as an admin, then as a member, then in another tenant. Each app does this differently (a localStorage key, a cookie, an API call), and most end up building a one-off dev switcher inside their own UI. That work is repeated per app, and an AI assistant cannot see or drive it.

## Solution

A **Switcher** Plugin that lets a person choose among **Options** the app defines. The app supplies the Options, a way to read the current one, and an `apply` step; the Switcher knows nothing about what "switching" means (ADR 0002). Each **Axis** (user, tenant, role) is its own Switcher instance, so an app with two Axes adds two Plugins. The Toolbar shows the current Option for each Axis and a menu to change it. After a successful apply the page reloads so the app starts cleanly in the new context. The current Options appear in the Debug bundle, which tells an assistant exactly which context a bug was seen in.

## User Stories

1. As an app developer, I want to add a Switcher for an Axis by giving it a name, a list of Options and an `apply` function, so that I get a dev switcher without building UI.
2. As an app developer, I want to add one Switcher per Axis (for example user and tenant), so that each can be changed on its own.
3. As an app developer, I want a Switcher to be opt-in, so that the Belt never shows a switcher that is not configured.
4. As a developer, I want the Toolbar to show the Axis name and the current Option, so that I always know which context I am in.
5. As a developer, I want to open a menu and pick another Option, so that I can change context in two clicks.
6. As a developer, I want each Option to show a label and, if the app gave one, a short description, so that similar Options are distinguishable (for example two tenants with similar names).
7. As a developer, I want the current Option marked in the menu, so that I can see where I am.
8. As a developer, I want the page to reload after the switch succeeds, so that the app starts fresh in the new context.
9. As a developer looking at a framed device, I want the reload to apply to the page I am looking at, so that the Frame does not reset to the full page unexpectedly.
10. As an app developer, I want to disable the automatic reload when my app can react in place, so that I can keep state across a switch.
11. As an app developer, I want to replace the reload with my own function, so that I can reload or navigate in a way my router prefers.
12. As an app developer, I want `apply` to be allowed to take time (an API call), so that signing in as another user is possible.
13. As a developer, I want the menu to show that a switch is in progress and ignore further picks until it finishes, so that I cannot start two switches at once.
14. As a developer, I want a failed switch to leave the current Option unchanged and tell me it failed, with the error message, so that I know nothing changed.
15. As an app developer, I want to give the Options as a list or as a function, so that the list can depend on state such as the user chosen on another Axis.
16. As an app developer, I want the function to be allowed to be asynchronous, so that Options can come from an API.
17. As a developer, I want the Options to be read again every time the menu opens, so that a tenant list always matches the user I switched to.
18. As a developer, I want a loading state while Options are fetched and an error state if fetching fails, so that an empty menu is never confusing.
19. As an app developer, I want to say how the current Option is determined, so that the Switcher reflects reality after a reload.
20. As a developer, I want an unknown current Option (an id not in the list) shown as unknown with its id, so that a stale session is visible instead of hidden.
21. As an app developer, I want a clear error at setup time if two Options share an id or two Switchers share an Axis id, so that I find the mistake immediately.
22. As a developer, I want to pin or unpin each Switcher like any other Plugin, so that the Toolbar only carries the Axes I care about right now.
23. As a developer, I want Switchers to appear in the Toolbar in the order I listed the Plugins, so that related Axes sit together.
24. As an assistant user, I want the Debug bundle to state the current Option of every Switcher (label and id), so that a bug report includes the context it happened in.
25. As an AI agent, I want to read an Axis's Options and current Option, so that I know which contexts exist and which one is active.
26. As an AI agent, I want everything I read marked as untrusted page content, so that an Option's label or description cannot act as an instruction.
27. As a developer, I want the agent unable to switch context unless I allow it, so that a misled agent cannot sign in as someone else.
28. As a developer, I want to allow the agent to apply an Option with one setting, so that I can let it reproduce a bug across contexts when I trust the setup.
29. As an app maintainer, I want Option labels and descriptions rendered as plain text, so that data from my fixtures cannot inject markup into the Toolbar.
30. As an app maintainer, I want the Switcher to cost nothing in a production build, so that adding it does not ship fixture-switching code.
31. As a Plugin author, I want the Switcher built only on the public Plugin API, so that I can read it as an example of an Item with a menu.

## Implementation Decisions

- **Kind and opt-in.** A Built-in plugin in the main package's Plugin collection, not in the default list. Follows ADR 0002 (generic, one Axis per instance, Options may be a function) and ADR 0003.
- **Vocabulary.** The public term is **Switcher** (never "identity switcher"). Each entry is an **Option** with an id, a label and an optional description. Each independent dimension is an **Axis**.
- **Factory and options.** A factory taking: an Axis `id`, a display `name`, `options` (a list, or a function returning a list or a promise of one), `current` (a function returning the current Option id or null, synchronous or asynchronous), `apply` (receives the chosen Option, may be asynchronous), `reload` (true by default; false disables; a function replaces the default reload), an optional icon, and `agent` with a `write` flag (default false).
- **Plugin identity.** The Plugin's id is derived from the Axis id with a fixed prefix so it cannot collide with built-in Plugins or another Axis. Creating two Switchers with the same Axis id throws at setup. Duplicate Option ids within a list are reported in the console in development and the later duplicate is ignored.
- **Item.** A custom Toolbar Item showing the Axis name and the current Option's label, opening a menu built from the Belt's menu parts with one radio entry per Option (label, description beneath it when given, the current Option checked). While Options load, the menu shows a loading row; if the function rejects, an error row with the message and a retry action.
- **Switching.** Choosing an Option other than the current one calls `apply`. While it is pending the Item shows a busy state and further picks are ignored. On success the page reloads unless `reload` says otherwise. On failure nothing changes, the Item flashes a failure message and the menu shows the error text. Choosing the current Option does nothing.
- **Reload target.** The reload applies to what the person is looking at: the Frame's page if a device Frame is active, otherwise the top page. A custom reload function receives no arguments and is responsible for everything.
- **Current Option.** Evaluated when the Item mounts and again after every apply. If `current` returns an id that is not among the Options, the Item shows "Unknown" with that id and the menu has nothing checked. If `current` throws, the Item shows an unknown state and the Debug bundle says the current Option could not be read.
- **Options evaluation.** When `options` is a function it is called every time the menu opens, never cached across opens. Option labels and descriptions are plain text.
- **Debug bundle.** Contributes one header line per Switcher: the Axis name, the current Option's label and id. If current is unknown or unreadable, the line says so.
- **Agent tools.** Read: one tool per Axis returning the Options (id, label, description) and the current Option id; output is annotated read-only and untrusted. Write (registered only when `agent.write` is true): one tool per Axis that applies an Option by id, annotated not read-only. Tool names carry the Axis id. If `agent.write` is false the apply tool does not exist at all.
- **Pinning.** Pinned by default when added (the app opted in on purpose); the person can unpin it from More tools like any Plugin.
- **No storage knowledge.** The Plugin never reads or writes localStorage, cookies or any app state itself. Everything that makes the switch real is inside the app's `apply` and `current`.
- **Plugin API.** Fits `apiVersion` 1 with no core change. It exercises a custom Item that opens a menu and an Agent tool whose presence depends on an option.

## Testing Decisions

- **What a good test looks like.** It behaves like a person or agent: open the menu, pick an Option, see what the Toolbar, the Debug bundle and the Agent tools say, and see what the app's callbacks were given. It asserts nothing about internal state.
- **One seam.** Render the Belt (without shadow isolation) with one or two Switchers whose `options`, `current` and `apply` are test doubles. Interact by role and name. Agent tools are called through the global object. The Debug bundle is read through the copy action or its Agent tool. The reload step is observed through the replaceable reload option, so no test depends on the browser's real reload.
- **Behaviours to cover.** Current Option shown; menu lists Options with descriptions and a checked current one; picking calls `apply` with the Option; reload runs after success and not after failure; `reload` false and custom function; busy state and ignored picks while pending; failure message and unchanged Option; Options as a function re-evaluated per open, including async and its loading and error rows; unknown current Option; duplicate Option ids and duplicate Axis ids; two Axes where the second's Options depend on the first; pin and unpin; Debug bundle line; Agent read output with untrusted annotation; apply tool absent by default and present with `agent.write`; reload target when a Frame is active.
- **Prior art.** The toolbar test file (menu interactions, pinning, display options flow including the language switch that reloads), the plugin-runtime test (Agent tools on the global) and the debug-bundle test.
- **Not covered by automated tests.** Real navigation after reload and shadow-root rendering of the menu, checked by hand with the example apps.

## Out of Scope

- Any built-in knowledge of users, tenants, roles, sessions, tokens or storage keys (ADR 0002).
- A nested or hierarchical Axis model; dependent Axes are handled by `options` being a function.
- Creating, editing or deleting Options from the UI; the app owns the list.
- Persisting the current Option itself; the app's `apply` and `current` own that.
- Disabled Options, groups and search inside the menu in v1.
- Keyboard shortcuts for switching.

## Further Notes

- The default reload hides bugs where the app mishandles an in-place switch. Apps that care should turn it off and test the in-place path deliberately.
- The origin of this Plugin was an app's own dev user and tenant switcher over fixture data. That app is the first intended consumer and the best check that the model is sufficient, in particular that a tenant Axis depending on a user Axis works through `options` as a function.
- Option ids are the stable handle for agents and tests; labels are for people and may change.
