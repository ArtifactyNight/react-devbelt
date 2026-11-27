---
"react-devbelt": minor
---

The `storage()` plugin can now edit a value, delete an entry and clear a store (localStorage, sessionStorage and readable cookies) from its Window. Redacted values can be replaced or deleted without being shown, and clearing keeps `devbelt:*` keys. The matching Agent tools (`devbelt_set_storage_item`, `devbelt_delete_storage_item`, `devbelt_clear_storage`) are write tools: they are off until `agent: { write: true }` is set on the plugin.
