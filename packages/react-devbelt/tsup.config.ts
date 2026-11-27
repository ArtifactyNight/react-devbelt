import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as const,
  dts: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "react-dom", "react/jsx-runtime", "next"],
  // ui-sdk is bundled, so users need no ui-sdk and never hit a version clash
  noExternal: [/^@ui-sdk\//],
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      install: "src/install.ts",
      plugins: "src/plugins/index.ts",
      ui: "src/ui/index.ts",
    },
    splitting: true,
    clean: false,
    banner: { js: '"use client";' },
  },
  {
    // plain, server-safe: no React, no "use client"
    ...shared,
    entry: { core: "src/core/index.ts", next: "src/next.ts" },
    splitting: false,
    clean: false,
  },
]);
