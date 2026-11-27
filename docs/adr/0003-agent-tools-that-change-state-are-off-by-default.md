# Agent tools that change state are off by default

Agent tools that only read are available once their Plugin is on. Agent tools that change state (editing storage, refetching or invalidating queries) are off until the app sets `agent: { write: true }` on that Plugin. Everything an Agent tool returns from the page is marked untrusted content.

**Why:** page content can contain text written to steer an agent, and a browser agent calling a state-changing tool can be misled into acting. Defaulting to read-only makes the safe setup the one that needs no thought. Turning a default from off to on later is easy; the reverse breaks people.

**Cost:** agents cannot do these actions out of the box, and each Plugin must declare which of its tools write. The existing `set_viewport` tool changes state but only the framing of the page, so it stays on.
