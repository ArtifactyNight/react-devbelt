// Copies the root README into the package folder so npm shows the same page as GitHub.
// Relative links (docs/..., packages/...) would break on npm, so they point at GitHub instead.
// Run from a package folder: it reads ../../README.md and writes ./README.md.
import { readFileSync, writeFileSync } from "node:fs";

const repo = "https://github.com/ArtifactyNight/react-devbelt/blob/main/";
const root = readFileSync("../../README.md", "utf8");

const synced = root.replace(/\]\((?!#|[a-z][a-z0-9+.-]*:|\/\/)([^)\s]+)\)/gi, (_, path) => `](${repo}${path.replace(/^\.?\//, "")})`);

writeFileSync("README.md", synced);
console.log(`react-devbelt: README synced from the repo root`);
