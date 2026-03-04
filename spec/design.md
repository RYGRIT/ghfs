# ghfs Design Spec

## Purpose
This document is the implementation reference for `ghfs`, consolidating the original v1 plan and all follow-up product/engineering instructions.

## Product Summary
`ghfs` mirrors GitHub issues and pull requests into local files for offline review and batch maintenance, then applies explicit operations back to GitHub.

## Finalized Decisions (Original Plan + Later Instructions)
1. Project name is `ghfs`.
2. CLI framework is `cac`.
3. GitHub API client is `octokit` (+ retry + throttling plugins).
4. Prompt library is `@clack/prompts`.
5. Execution file is `.ghfs/execute.yml` (not pending).
6. Validation stack is `valibot` (not ajv).
7. Source layout is grouped by domain:
   - `src/sync/*`
   - `src/execute/*`
8. Sync state metadata file is `.ghfs/.sync.json`.
9. Mirrored docs are unified under `.ghfs/issues/<number>.md`.
10. Closed docs are moved to `.ghfs/issues/closed/<number>.md`.
11. Open PR patch is mirrored as `.ghfs/issues/<number>.patch`.
12. Closed PR patch is deleted.
13. `ghfs` default command is `sync`.
14. `execute` is dry-run by default and interactive in TTY.

## Goals
1. Local-first, reviewable mirror of issues and PRs.
2. Deterministic batch operations via explicit execute file.
3. Safe execution defaults (`dry-run`, conflict guard).
4. Clear CLI UX for maintainers and automation.

## Non-Goals (v1)
1. Inferring write operations from edited markdown.
2. PR merge/rebase/squash/auto-merge.
3. Deep review-thread workflows.

## CLI Contract
1. `ghfs` -> alias of `ghfs sync`
2. `ghfs sync [--repo owner/name] [--since ISO] [--full]`
3. `ghfs execute [--file .ghfs/execute.yml] [--apply] [--non-interactive] [--continue-on-error]`
4. `ghfs status`
5. `ghfs schema` (writes execute schema file)

## Configuration Contract (`ghfs.config.ts`)
Main fields:
- `repo?: string`
- `storageDir?: string` (default `.ghfs`)
- `executeFile?: string` (default `.ghfs/execute.yml`)
- `auth?: { preferGhCli?: boolean; tokenEnv?: string[] }`
- `detectRepo?: { fromGit?: boolean; fromPackageJson?: boolean }`
- `sync?: { includeClosed?: boolean; writePrPatch?: boolean; deleteClosedPrPatch?: boolean }`
- `cli?: { interactiveExecuteInTTY?: boolean }`

Resolution precedence:
1. CLI flags
2. `ghfs.config.*`
3. repo auto-detection
4. `.ghfs/.sync.json` stored repo

## Repository Resolution
Priority:
1. `--repo`
2. config `repo`
3. git remote (`origin`, `upstream`, then remaining)
4. `package.json.repository`
5. `.ghfs/.sync.json`

Conflict handling:
- TTY: interactive source selection
- non-TTY: hard error requiring explicit `--repo`

## Auth Resolution
Priority:
1. `gh auth token` (if enabled)
2. env tokens (`GH_TOKEN`, `GITHUB_TOKEN`)
3. TTY prompt

If non-TTY and no token, fail fast.

## Filesystem Contract
```txt
.ghfs/
  .sync.json
  execute.yml
  schema/
    execute.schema.json
  issues/
    <number>.md
    <number>.patch        # open PR only
    closed/
      <number>.md
```

## Mirror Document Contract (`.md`)
Frontmatter includes:
- `schema`, `repo`, `number`, `kind`, `state`, `title`
- `author`, `labels`, `assignees`, `milestone`
- `created_at`, `updated_at`, `closed_at`, `last_synced_at`
- PR-only: `is_draft`, `merged`, `merged_at`, `base_ref`, `head_ref`, `reviewers_requested`

Body sections:
1. Title
2. Description
3. Comments (with comment id and timestamps)

## Execute File Contract (`.ghfs/execute.yml`)
Root is a YAML array.
Each item has:
- `action`
- `number`
- optional `ifUnchangedSince`
- action-specific fields (e.g. `body`, `labels`, `reviewers`, `milestone`, `reason`)

No root `version/repo`; no per-op `id/target`.

Supported actions:
- `close`
- `reopen`
- `set-title`
- `set-body`
- `add-comment`
- `add-labels`
- `remove-labels`
- `set-labels`
- `add-assignees`
- `remove-assignees`
- `set-assignees`
- `set-milestone`
- `clear-milestone`
- `lock`
- `unlock`
- `request-reviewers`
- `remove-reviewers`
- `mark-ready-for-review`
- `convert-to-draft`

## Sync Behavior
1. Resolve repo and token.
2. Pull issues/PRs (incremental via `.sync.json` cursor unless `--full`).
3. Render markdown mirror files.
4. Move closed/open docs between root and `closed/`.
5. Write PR patch for open PRs.
6. Delete PR patch for closed PRs.
7. Persist sync state and counters in `.ghfs/.sync.json`.

## Execute Behavior
1. Parse and validate `.ghfs/execute.yml` via valibot + rule checks.
2. In TTY interactive mode, allow selecting operations.
3. Print execution plan.
4. If no `--apply`, stop (dry-run).
5. If `--apply`, optionally confirm in TTY then execute in order.
6. For each op:
   - fetch issue/PR
   - enforce `ifUnchangedSince` conflict guard
   - apply mapped GitHub operation
7. Save run summary to sync state execution history.

## Validation Strategy
Two layers:
1. Structural validation with valibot.
2. Semantic rule validation (`number > 0`, required payload fields by action, valid datetime).

## Code Organization
- `src/cli.ts`: command orchestration.
- `src/config.ts`: config discovery/default merge.
- `src/github/*`: auth, repo detection, octokit client.
- `src/sync/*`: mirror rendering, paths, state, status, sync flow.
- `src/execute/*`: execute schema, types, parser/validator, apply engine.
- `src/types.ts`: shared public/internal core types.

## Testing Strategy
Tests are colocated with implementation (`src/**.test.ts`).
Current focus:
1. repo normalization
2. markdown rendering
3. sync path generation
4. execute validation (parse + rule checks)
5. config resolution defaults/overrides

## Operational Defaults
1. `sync` non-interactive by default.
2. `execute` interactive in TTY by default.
3. `execute` is dry-run by default; use `--apply` to mutate.
4. Continue-on-error is opt-in via `--continue-on-error`.

## Future Extensions (Post-v1)
1. Optional VS Code extension for guided sync/execute.
2. Additional GitHub maintainer actions (assess carefully for safety).
3. More robust pagination/caching and richer conflict policies.
