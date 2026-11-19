# Coding agent instructions

These instructions apply to the whole repository and to every coding agent.
Read [the coding agent guide](docs/CODING_AGENT_GUIDE.md) before making changes.

## Git rules

- Never commit directly to `dev` or `main`.
- Create a task branch from `dev` before editing: `feature/<short-topic>`,
  `fix/<short-topic>`, `docs/<short-topic>`, or `chore/<short-topic>`.
- Reuse an existing task branch when continuing the same work. Inspect the
  working tree first and preserve unrelated user changes.
- Submit task branches for review through a pull request targeting `dev`.
  Keep `main` for releases through the repository's release process.
- Before every commit, check the current branch and staged diff. Stop if the
  branch is `dev`, `main`, or detached; switch to a task branch first.
- Do not force push, reset shared history, delete branches, merge, or publish
  changes unless the user has authorized the action.

## Implementation and verification

- Follow the existing React/TypeScript/Vite frontend and Python/FastAPI backend
  architecture. Preserve resume JSON compatibility and LaTeX template behavior.
- Use relevant skills from the guide when available. The guide's plain-language
  workflows also apply when an agent does not support skills.
- Validate changes with checks appropriate to their scope and report actual
  results, including any checks that could not run.
- Never expose `.env` contents, credentials, personal resume data, or generated
  private documents in logs, commits, or review descriptions.
