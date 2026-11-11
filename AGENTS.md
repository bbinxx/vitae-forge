# Agent instructions for Vitae Forge

## Project

Vitae Forge is a resume studio and job application tracker. The frontend uses React 18, TypeScript, Vite, and plain CSS. The backend uses Python, FastAPI, Firebase/Firestore, and LaTeX PDF compilation. Read [README.md](README.md) and [the skills guide](docs/SKILLS.md) before making changes.

## Branch workflow

- Use a dedicated feature branch for each task, including documentation changes. Check `git status --short` and the current branch first; preserve existing user changes.
- Use descriptive branch names such as `feat/resume-editor`, `fix/pdf-preview`, or `docs/agent-guide`.
- Keep commits focused. Do not merge, push, or deploy unless requested.

## Code map and conventions

- `frontend/src/pages/`: application screens; `components/`: shared UI and layout; `stores/`: state; `types/index.ts`: shared frontend contracts.
- `frontend/src/services/api.ts`: shared request handling and typed endpoints. Preserve authentication headers, error handling, and upload behavior when changing API calls.
- `frontend/src/assets/index.css`: existing styling. Follow the current visual language and support keyboard navigation and mobile layouts.
- `backend/api/`: HTTP routes; `backend/services/`: application operations; `backend/db/`: persistence abstractions; `backend/core/`: config, generation, and compilation.
- `backend/templates/tex/`: resume and cover letter templates; `backend/core/defaults/starter_config.json`: starter schema; `prompts/ATS_Prompt.md`: import guidance. Keep these consistent when changing resume fields.
- Keep API types and backend payloads aligned. Preserve user scoping for stored resumes, applications, photos, and checkpoints.
- Preserve ATS readability, LaTeX escaping, section ordering, links, and one-page layout behavior when changing generation. Check the resulting PDF for relevant template changes.
- Keep secrets and personal resume data out of source, logs, examples, and commits. Use synthetic fixtures. Do not edit generated build output or local dependency directories.

## Skill selection

Read a matching skill's `SKILL.md` before applying it. Global skills normally live at `~/.agents/skills/<name>/SKILL.md`; discover actual paths with `npx skills list -g`. Skills supplement the user's instructions and the repository's actual stack.

| Task | Skills to use when applicable |
| --- | --- |
| React implementation and performance | `vercel-react-best-practices` |
| Reusable components and state composition | `vercel-composition-patterns` |
| New UI or substantial visual changes | `frontend-design` |
| Accessibility and UI review | `web-design-guidelines` |
| Reproducing and diagnosing bugs | `systematic-debugging` |
| Multi-step implementation planning | `writing-plans` |
| Features and regression fixes needing automated coverage | `test-driven-development` |
| Completion and validation claims | `verification-before-completion` |
| Substantial change review | `requesting-code-review` |
| Work requiring a separate checkout | `using-git-worktrees` |
| Discovering additional skills | `find-skills` |

Apply only React 18 and Vite-compatible guidance: this repo does not use Next.js, React Server Components, or React 19 APIs. Android, Compose, Kotlin, and Android PDF skills do not apply to this Python/LaTeX application. See [docs/SKILLS.md](docs/SKILLS.md) for conditional image skills and the complete global inventory. An inventory entry does not authorize installing packages or invoking unrelated workflows.

## Run and verify

Run commands from the repository root unless noted:

```bash
# Backend development (with project Python dependencies installed)
uvicorn backend.app:app --host 127.0.0.1 --port 5050 --reload

# Frontend development
npm --prefix frontend run dev

# Frontend type check and production build
npm --prefix frontend run build
```

Vite serves port 5173 and proxies backend routes to port 5050; inspect `frontend/vite.config.ts` when adding routes. PDF compilation requires `pdflatex` and the needed TeX packages.

There is no frontend test or lint script in the current package manifest and no checked-in automated test suite was found during setup. Do not invent successful test results. For backend edits, run focused checks with isolated fixtures and mocked cloud services as appropriate. For frontend edits, run the build and check affected interactions. For documentation-only edits, verify links, paths, and `git diff --check`; a production build is unnecessary. Report commands run, results, and any remaining verification limits.
