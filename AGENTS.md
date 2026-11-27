## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Git conventions

### Commits (Conventional Commits)

Format: `type(scope): subject`, with an optional body and footers.

- **Types**: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. Use `feat` and `fix` only for changes a user of the package can see; they map to a changeset bump (`feat` = minor, `fix` = patch while on `0.x`).
- **Scope** (optional, lowercase): a Plugin id (`network`, `console`, `viewport`, `grab`, `storage`, `switcher`, `breakpoint`), an area (`core`, `ui`, `next`, `plugin-api`, `agent-tools`, `debug-bundle`), `examples`, `docs`, or `deps`. One scope per commit; omit it if the change spans several.
- **Subject**: imperative mood ("add", not "added"), lowercase, no trailing period, 72 characters or fewer. Use Glossary terms (Plugin, Item, Window, Agent tool, Debug bundle), not synonyms the glossary avoids.
- **Body**: only when the why isn't obvious. Wrap at 100 columns.
- **Breaking changes**: `!` after the type/scope (`feat(plugin-api)!: ...`) and a `BREAKING CHANGE:` footer. The plugin API stays `apiVersion: 1` with additive changes only, so a breaking change needs an ADR first.
- **Issue references**: footer `Refs: .scratch/<feature>/issues/NN-slug.md` (local tracker), or `Closes #N` once a GitHub tracker is used.
- One logical change per commit. Don't mix refactors with behaviour changes. Keep each commit green (`pnpm typecheck && pnpm test && pnpm lint`).
- Never commit secrets, `.env*`, `dist/` or generated files already in `.gitignore`.

### Branches

- `main` is protected by convention: no direct pushes of feature work, no force-push.
- Branch name: `<type>/<short-kebab-slug>`, e.g. `feat/storage-plugin`, `fix/console-stack-dedupe`. Integration branches for a spec: `spec/<feature-slug>`; per-ticket branches: `ticket/<NN>-<slug>`.
- Rebase or merge `main` into your branch before opening a PR; no merge commits from `main` once rebased.

### Pull requests

- Title follows the commit format (`feat(storage): add read-only Window`); the PR is squash-merged and the title becomes the commit subject.
- User-visible changes include a changeset (`pnpm changeset`). `docs`, `test`, `ci` and `chore` changes don't.
- Body links the ticket or spec and notes any ADR it touches or contradicts.
