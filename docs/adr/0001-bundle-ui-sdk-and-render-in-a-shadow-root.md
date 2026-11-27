# Bundle ui-sdk and render in a shadow root

The Belt is built on ui-sdk, whose components are unstyled. We bundle ui-sdk into the package and compile the Belt's own Tailwind into one stylesheet that is injected into a shadow root, instead of asking the app to install ui-sdk and Tailwind.

**Why:** apps would otherwise need React 19, ui-sdk at a matching beta version and Tailwind, and the Belt's CSS and the page's would collide. Bundling and isolating means install-and-go and no style leaks either way. It is dev-only, so size does not matter.

**Cost:** ui-sdk is `0.1.0-beta`; upgrading it is our job and a second ui-sdk in the app is duplicated code. Tailwind v4's `@property` rules are ignored inside a shadow tree, so the build splits them out and registers them on the document. Plugin authors cannot rely on utility classes outside the compiled set and must ship CSS (`styles`) or reuse the shared class names.

**Rejected:** ui-sdk and Tailwind as peer dependencies (setup burden, version clashes); no shadow root with prefixed classes (still leaks the page's CSS in, and requires rewriting every class).
