# Switcher is generic, one Axis per instance

Withdrawn. The Switcher Plugin was removed. It could not work for every app without each app supplying Options and `apply`, which is outside the goal of a zero-config Belt. The record below is why it was shaped this way while it existed.

The first idea was an "identity switcher" over users and tenants. We ship a generic **Switcher** instead: named Options the app defines, an app-supplied `apply`, one Axis per Plugin instance. Options may be a function, so one Axis can depend on another.

**Why:** tenants, roles and flag sets are not identities, and the apps that need this (including the one this came from) each define "switching" differently: a localStorage key, a cookie, an API call. A Plugin that knew about users or tenants would be wrong for most of them. Nesting Axes into one model was rejected because dependencies between them are the app's business and a function covers them.

**Cost:** the app writes the `apply` and `current` callbacks; there is no zero-config path. After `apply` the page reloads by default, which hides state bugs an in-place switch would show.
