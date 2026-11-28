// Fails when a file named by package.json "types" (top level or in "exports") is missing.
// Run from a package folder, after the build: guards `pack` and `publish` against shipping without types.
import { existsSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const wanted = new Set();

const walk = (node) => {
  if (typeof node === "string" || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "types" && typeof value === "string") wanted.add(value);
    else walk(value);
  }
};
if (pkg.types) wanted.add(pkg.types);
walk(pkg.exports ?? {});

const missing = [...wanted].filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`${pkg.name}: type files missing after build:\n  ${missing.join("\n  ")}`);
  console.error("Is another build (`pnpm dev`, `tsup --watch`) rewriting dist/ at the same time?");
  process.exit(1);
}
console.log(`${pkg.name}: ${wanted.size} type files present`);
