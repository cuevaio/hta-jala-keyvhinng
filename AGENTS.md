<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Multi-Agent Workflow (Git Worktrees & Direct Merge to `main`)

Multiple agents work on this repository concurrently during the hackathon. **Do not work directly on `main` in the root checkout**, and **do not open Pull Requests** — always work in an isolated Git worktree and merge directly back into `main` when finished.

### 1. Start in an Isolated Worktree

Create a dedicated branch and worktree under `.worktrees/<task-slug>` (git-ignored) branched off `main`:

```bash
git worktree add .worktrees/<task-slug> -b feat/<task-slug> main
```

Set up the worktree environment before running checks or tests:

```bash
cp .env.local .worktrees/<task-slug>/.env.local 2>/dev/null || cp .env.example .worktrees/<task-slug>/.env.local
bun install --cwd .worktrees/<task-slug>
```

Perform **all** edits, commands, and commits inside `.worktrees/<task-slug>`.

### 2. Verify Before Merging

Inside your worktree (`.worktrees/<task-slug>`), ensure all checks pass and rebase onto the latest `main` in case another agent merged while you were working:

```bash
git -C .worktrees/<task-slug> rebase main
bun --cwd .worktrees/<task-slug> run lint
bun --cwd .worktrees/<task-slug> run typecheck
bun --cwd .worktrees/<task-slug> run test
```

### 3. Merge Directly into `main` & Clean Up

Do **not** open a PR. Once verified and rebased, merge directly into `main` from the root repository and remove the worktree:

```bash
git merge --ff-only feat/<task-slug>
git worktree remove .worktrees/<task-slug>
git branch -d feat/<task-slug>
```

> **Note:** If the root checkout has uncommitted changes from another session, coordinate or stash before merging into `main`. Never force-reset `main` or delete another agent's active `.worktrees/*` directory.
