# Coding agent guide

Vitae Forge is an ATS resume studio and application tracker. Its frontend uses
React 18, TypeScript, Vite, and CSS. Its backend uses Python and FastAPI with
PostgreSQL storage and a LaTeX PDF compilation engine.

This guide is shared by all coding agents. [AGENTS.md](../AGENTS.md) is the
repository instruction entry point. Agents without automatic instruction
discovery should read both files explicitly. Skill names below describe useful
capabilities; they do not require a particular vendor, local filesystem path,
plugin, or installation. Availability depends on the agent environment.

## Suitable skills

| Skill | When to use it | Portable workflow |
| --- | --- | --- |
| `vercel-react-best-practices` | React rendering, loading, state, and performance work | Inspect renders, effects, fetching, and bundle costs; apply React guidance relevant to Vite. |
| `frontend-design` | Studio, dashboard, tracker, or visual design changes | Establish visual direction and implement coherent typography, spacing, and responsive layouts. |
| `web-design-guidelines` | UI, accessibility, or UX reviews | Check semantics, labels, keyboard access, focus, contrast, responsive behavior, and error states. |
| `vercel-composition-patterns` | Shared editors, previews, and reusable components | Prefer clear component composition and explicit responsibilities over expanding boolean props. |
| `systematic-debugging` | API, authentication, caching, or PDF compilation failures | Reproduce, collect evidence, identify the cause, make a focused fix, and verify the original symptom. |
| `verification-before-completion` | Before completion claims, commits, or PRs | Run relevant checks, read their outputs, and report evidence and limitations. |
| `requesting-code-review` | Substantial changes or work preparing to merge | Review the final diff for correctness, regressions, security, and missing requirements. Use a supported review tool or self-review if none is available. |
| `using-git-worktrees` | Concurrent work or tasks needing directory isolation | Inspect existing isolation first; use an authorized worktree when needed and keep its directory out of version control. |
| `writing-plans` | Features spanning multiple components or layers | Write concrete implementation steps, affected areas, and validation before coding. |

Use the smallest relevant set. Android skills do not apply to the current stack.
If a skill is missing, follow its portable workflow above; do not install tools
or skills automatically. Follow the user's instructions and repository rules
when a skill suggests a different branch or approval workflow.

## Feature branch workflow

**Never commit directly to `dev` or `main`, including documentation and small fixes.**

1. Inspect `git status --short` and `git branch --show-current`. Preserve any
   unrelated changes. Continue on an existing task branch for the same task.
2. For new work, start from the latest available `dev`. Fetch and fast-forward
   it when network access and the working tree allow. Do not reset a diverged
   branch or silently discard changes.
3. Create a descriptive task branch before editing:

   ```bash
   git switch dev
   git fetch origin
   git merge --ff-only origin/dev
   git switch -c feature/resume-preview
   ```

   This example assumes a clean working tree and an `origin/dev` remote branch.
   If fetching is unavailable, use local `dev` and report that its freshness
   could not be verified. Use `fix/<topic>`, `docs/<topic>`, or `chore/<topic>`
   for other task types. Do not change branches over unrelated local edits.
4. Implement a focused change. Use a worktree when isolation is needed and
   authorized; a separate working directory does not remove the branch rule.
5. Run appropriate checks and review the diff. Before each commit, run
   `git branch --show-current` and `git diff --cached`; verify the branch is a
   task branch and only intended files are staged. Do not use blanket staging
   when unrelated changes exist.
6. When committing is authorized, make focused commits on the task branch.
   Push and open a PR targeting `dev` when authorized. Include the behavior
   change, verification results, and material limitations in the PR.
7. Merge through the reviewed PR workflow with required checks satisfied.
   Release changes to `main` through the repository's release process.

These are agent instructions, not server-enforced branch protection. Repository
administrators can additionally enforce pull requests and required checks on
`dev` and `main` in the hosting service.

## Verification by change type

- **Documentation:** run `git diff --check`; check links and consistency with
  actual repository paths and commands.
- **Frontend:** run `npm run build` from `frontend/` for TypeScript checking and
  the production build. For UI changes, inspect affected screens at relevant
  viewport sizes and exercise keyboard interaction.
- **Backend:** run available tests for the affected behavior and exercise the
  affected API. Cover success and error paths; use synthetic resume data.
- **LaTeX/templates:** compile representative synthetic resumes, inspect the
  PDF, and verify page count, links, and overflow for affected layouts.
- **Cross-layer changes:** verify the complete affected UI/API/PDF workflow.

The frontend currently declares no test or lint script. Do not claim those
checks passed or invent commands. Run existing relevant checks; add meaningful
regression tests for behavior changes when appropriate. Report missing tools,
dependencies, credentials, or services that prevent verification.
