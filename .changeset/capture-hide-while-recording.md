---
"react-devbelt": minor
---

`capture()` hides the toolbar, its windows, popovers and the size HUD while the screen is recorded, so none of it is in the video, and shows them again when the recording ends. Turn it off with `capture({ hideWhileRecording: false })` or, per person, with "Hide toolbar while recording" in More tools. The toolbar API gains `setHidden()` and `isHidden()`.
