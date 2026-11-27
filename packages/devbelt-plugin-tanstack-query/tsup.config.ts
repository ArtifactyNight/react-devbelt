import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.tsx" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "react/jsx-runtime", "react-devbelt", "@tanstack/react-query"],
  banner: { js: '"use client";' },
});
