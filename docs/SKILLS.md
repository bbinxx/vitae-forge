# Skills guide for Vitae Forge

## Scope and discovery

Inventory captured on 2026-11-11 using `npx skills list -g`. This is a snapshot of globally installed skills on the development machine, not a repository dependency or an instruction to use every skill. No additional skills were installed for this guide. Skills supplied separately by agent plugins may not appear in this CLI inventory.

Read [AGENTS.md](../AGENTS.md) for repository conventions and the feature branch workflow. Before using a skill, open its `SKILL.md` and check its actual scope. Expand `~` to the current user's home directory. If a skill is missing on another machine, use the available session catalog or report that it is unavailable; do not assume that a global path exists or silently install it.

Refresh the inventory with:

```bash
npx skills list -g
```

## Recommended task routing

| Skill | When it fits this repository | Limits |
| --- | --- | --- |
| `vercel-react-best-practices` | Implement or optimize React pages, requests, effects, rendering, and bundles. | Apply client React/Vite advice; skip Next.js, server component, and server action rules. |
| `vercel-composition-patterns` | Refactor shared components, context, or components with too many boolean modes. | Keep React 18-compatible APIs; do not introduce React 19 APIs. |
| `frontend-design` | Design new studio screens or make substantial visual improvements. | Ground changes in resume editing, application tracking, and existing CSS. |
| `web-design-guidelines` | Review accessibility, forms, keyboard focus, responsive layout, and interaction design. | Read the skill and retrieve its current guidelines when performing a review. |
| `systematic-debugging` | Investigate API errors, state issues, failed builds, or PDF compilation faults. | Reproduce and find the cause before changing code. |
| `writing-plans` | Plan changes spanning frontend, backend, data contracts, or templates. | Scale the plan to the task; keep it actionable. |
| `test-driven-development` | Add meaningful behavioral or regression coverage for code changes. | Use isolated fixtures; documentation-only edits do not need application tests. |
| `verification-before-completion` | Verify a change before claiming that it is complete or passing. | State the actual command and result; distinguish build checks from behavior checks. |
| `requesting-code-review` | Review substantial features or fixes before integration. | Review the diff against requirements and validation evidence. |
| `using-git-worktrees` | Isolate implementation when the existing checkout must remain available. | Always use a feature branch; a separate worktree is conditional. |
| `find-skills` | Discover skills when the existing selection does not cover the requested work. | Verify scope and source before recommending or installing anything. |

These skills normally resolve to `~/.agents/skills/<skill-name>/SKILL.md`. The inventory below records actual discovery paths and agent registrations. An Antigravity-only or Hermes-only registration does not imply availability to Codex.

## Conditional and unrelated skills

`image-fundamentals` may help with profile photo color space, format, or dimensions in `backend/services/photo_service.py` and `backend/core/upload.py`. `preprocessing-decisions`, `contour-analysis`, `morphology-toolkit`, and `thresholding-strategy` apply only if requested image analysis work needs those operations. Do not introduce image processing pipelines for ordinary resume editing.

The installed Android, Kotlin, Compose, Gradle, Wear, XR, and Android PDF annotation skills target a different platform. In particular, `pdf-annotations` concerns Android PDF APIs, and `testing-setup` concerns Android test infrastructure. Neither supplies a testing or PDF workflow for this FastAPI/LaTeX repo. MediaPipe and YOLO skills likewise have no current application here.

The CLI also reports agent-specific GCP/data, notebook, ML, and other skills. Their presence does not justify introducing those technologies. No dedicated FastAPI, Python testing, LaTeX, or Firestore skill is identified in this inventory. For those areas, follow the code, dependency versions, and relevant official documentation.

## Complete global inventory

Paths below identify skill directories; read `SKILL.md` within the directory. `untracked` is the source status reported by the CLI, not a verified publisher identity. This list records availability, not a recommendation or activation.

The command reported **131 skill entries**.

| Skill | Directory | Registered agents | Reported source |
| --- | --- | --- | --- |
| `adaptive` | `~/.agents/skills/adaptive` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `agp-9-upgrade` | `~/.agents/skills/agp-9-upgrade` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `android-cli` | `~/.agents/skills/android-cli` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `android-for-cars-parked-apps` | `~/.agents/skills/android-for-cars-parked-apps` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `android-intent-security` | `~/.agents/skills/android-intent-security` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `android-permissions-security` | `~/.agents/skills/android-permissions-security` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `android-profiler` | `~/.agents/skills/android-profiler` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `anr-audit-and-fix` | `~/.agents/skills/anr-audit-and-fix` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `appfunctions` | `~/.agents/skills/appfunctions` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `camerax` | `~/.agents/skills/camerax` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `display-glasses-with-jetpack-compose-glimmer` | `~/.agents/skills/display-glasses-with-jetpack-compose-glimmer` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `edge-to-edge` | `~/.agents/skills/edge-to-edge` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `engage-sdk-integration` | `~/.agents/skills/engage-sdk-integration` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `glance-appwidget-updates-and-memory` | `~/.agents/skills/glance-appwidget-updates-and-memory` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `glance-canonical-layouts` | `~/.agents/skills/glance-canonical-layouts` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `ink-app-builder` | `~/.agents/skills/ink-app-builder` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `ink-custom-brush-builder` | `~/.agents/skills/ink-custom-brush-builder` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `jetpack-compose-performance` | `~/.agents/skills/jetpack-compose-performance` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `leanback-to-compose-tv-migration` | `~/.agents/skills/leanback-to-compose-tv-migration` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `litert-lm` | `~/.agents/skills/litert-lm` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `litert-runtime` | `~/.agents/skills/litert-runtime` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `media3-cast-integration` | `~/.agents/skills/media3-cast-integration` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `migrate-xml-views-to-jetpack-compose` | `~/.agents/skills/migrate-xml-views-to-jetpack-compose` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `ml-kit-genai-prompt-api` | `~/.agents/skills/ml-kit-genai-prompt-api` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `mlkit-agent-api` | `~/.agents/skills/mlkit-agent-api` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `navigation-3` | `~/.agents/skills/navigation-3` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `navigation-event` | `~/.agents/skills/navigation-event` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `play-billing-library-version-upgrade` | `~/.agents/skills/play-billing-library-version-upgrade` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `play-policy-insights` | `~/.agents/skills/play-policy-insights` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `projected-hardware` | `~/.agents/skills/projected-hardware` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `r8-analyzer` | `~/.agents/skills/r8-analyzer` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `restore-credentials` | `~/.agents/skills/restore-credentials` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `testing-setup` | `~/.agents/skills/testing-setup` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `verified-email` | `~/.agents/skills/verified-email` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `wear-compose-m3` | `~/.agents/skills/wear-compose-m3` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `wear-widgets` | `~/.agents/skills/wear-widgets` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `android/skills` |
| `android-compose-ui` | `~/.agents/skills/android-compose-ui` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-data-layer` | `~/.agents/skills/android-data-layer` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-debugging` | `~/.agents/skills/android-debugging` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `android-dev` | `~/.agents/skills/android-dev` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `android-di-koin` | `~/.agents/skills/android-di-koin` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-error-handling` | `~/.agents/skills/android-error-handling` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-gradle-logic` | `~/.agents/skills/android-gradle-logic` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `android-module-structure` | `~/.agents/skills/android-module-structure` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-navigation` | `~/.agents/skills/android-navigation` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-presentation-mvi` | `~/.agents/skills/android-presentation-mvi` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-retrofit` | `~/.agents/skills/android-retrofit` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `android-source-search` | `~/.agents/skills/android-source-search` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `android-testing` | `~/.agents/skills/android-testing` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `humanshell/android-skills` |
| `android-ux` | `~/.agents/skills/android-ux` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `auditing-compose-performance` | `~/.agents/skills/auditing-compose-performance` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `avoiding-subcomposition-pitfalls` | `~/.agents/skills/avoiding-subcomposition-pitfalls` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `choosing-derivedstateof` | `~/.agents/skills/choosing-derivedstateof` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `coil-compose` | `~/.agents/skills/coil-compose` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `collecting-flows-safely` | `~/.agents/skills/collecting-flows-safely` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `compose` | `~/.agents/skills/compose` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `compose-expert` | `~/.agents/skills/compose-expert` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aldefy/compose-skill` |
| `configuring-lazy-prefetch` | `~/.agents/skills/configuring-lazy-prefetch` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `contour-analysis` | `~/.agents/skills/contour-analysis` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `datastore` | `~/.agents/skills/datastore` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `debugging-recompositions` | `~/.agents/skills/debugging-recompositions` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `deferring-state-reads` | `~/.agents/skills/deferring-state-reads` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `diagnosing-compose-stability` | `~/.agents/skills/diagnosing-compose-stability` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `enforcing-stability-in-ci` | `~/.agents/skills/enforcing-stability-in-ci` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `find-skills` | `~/.agents/skills/find-skills` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `vercel-labs/skills` |
| `frontend-design` | `~/.agents/skills/frontend-design` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `untracked` |
| `generating-baseline-profiles` | `~/.agents/skills/generating-baseline-profiles` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `gradle-build-performance` | `~/.agents/skills/gradle-build-performance` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `image-fundamentals` | `~/.agents/skills/image-fundamentals` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `iterating-with-ai-and-mcp` | `~/.agents/skills/iterating-with-ai-and-mcp` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `kmp-boundaries` | `~/.agents/skills/kmp-boundaries` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `kmp-ktor` | `~/.agents/skills/kmp-ktor` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `koin` | `~/.agents/skills/koin` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `kotlin-coroutines` | `~/.agents/skills/kotlin-coroutines` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `kotlin-flows` | `~/.agents/skills/kotlin-flows` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `mediapipe-tracking` | `~/.agents/skills/mediapipe-tracking` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `migrating-to-modifier-node` | `~/.agents/skills/migrating-to-modifier-node` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `mobile-android-design` | `~/.agents/skills/mobile-android-design` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `wshobson/agents` |
| `modularization` | `~/.agents/skills/modularization` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `morphology-toolkit` | `~/.agents/skills/morphology-toolkit` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `optimizing-lazy-layouts` | `~/.agents/skills/optimizing-lazy-layouts` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `ordering-modifier-chains` | `~/.agents/skills/ordering-modifier-chains` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `paging` | `~/.agents/skills/paging` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `pdf-annotations` | `~/.agents/skills/pdf-annotations` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `preprocessing-decisions` | `~/.agents/skills/preprocessing-decisions` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `preserving-state-across-reloads` | `~/.agents/skills/preserving-state-across-reloads` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `requesting-code-review` | `~/.agents/skills/requesting-code-review` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `obra/superpowers` |
| `rxjava-migration` | `~/.agents/skills/rxjava-migration` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `rcosteira79/android-skills` |
| `setting-up-compose-hotswan` | `~/.agents/skills/setting-up-compose-hotswan` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `stabilizing-compose-types` | `~/.agents/skills/stabilizing-compose-types` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `systematic-debugging` | `~/.agents/skills/systematic-debugging` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `obra/superpowers` |
| `test-driven-development` | `~/.agents/skills/test-driven-development` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `obra/superpowers` |
| `testing-compose-in-release-mode` | `~/.agents/skills/testing-compose-in-release-mode` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `thresholding-strategy` | `~/.agents/skills/thresholding-strategy` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `tracing-recompositions-at-runtime` | `~/.agents/skills/tracing-recompositions-at-runtime` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `understanding-hot-reload-limits` | `~/.agents/skills/understanding-hot-reload-limits` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `understanding-stability-inference` | `~/.agents/skills/understanding-stability-inference` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `using-efficient-effects` | `~/.agents/skills/using-efficient-effects` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `using-git-worktrees` | `~/.agents/skills/using-git-worktrees` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `obra/superpowers` |
| `using-stability-analyzer-ide-plugin` | `~/.agents/skills/using-stability-analyzer-ide-plugin` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `using-strong-skipping-correctly` | `~/.agents/skills/using-strong-skipping-correctly` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `vercel-composition-patterns` | `~/.agents/skills/vercel-composition-patterns` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `untracked` |
| `vercel-react-best-practices` | `~/.agents/skills/vercel-react-best-practices` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `untracked` |
| `verification-before-completion` | `~/.agents/skills/verification-before-completion` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `obra/superpowers` |
| `visualizing-recomposition-cascades` | `~/.agents/skills/visualizing-recomposition-cascades` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `skydoves/compose-performance-skills` |
| `web-design-guidelines` | `~/.agents/skills/web-design-guidelines` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `untracked` |
| `writing-plans` | `~/.agents/skills/writing-plans` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `obra/superpowers` |
| `yolo-pipeline` | `~/.agents/skills/yolo-pipeline` | Codex, Gemini CLI, GitHub Copilot, OpenCode | `aeren23/image-processing-skills` |
| `accidental-data-loss-prevention` | `~/.gemini/config/skills/accidental-data-loss-prevention` | Antigravity | `untracked` |
| `bigquery-data-transfer-service` | `~/.gemini/config/skills/bigquery-data-transfer-service` | Antigravity | `untracked` |
| `building-data-apps` | `~/.gemini/config/skills/building-data-apps` | Antigravity | `untracked` |
| `cloud-databases-onboarding` | `~/.gemini/config/skills/cloud-databases-onboarding` | Antigravity | `untracked` |
| `data-autocleaning` | `~/.gemini/config/skills/data-autocleaning` | Antigravity | `untracked` |
| `dataform-bigquery` | `~/.gemini/config/skills/dataform-bigquery` | Antigravity | `untracked` |
| `dbt-bigquery` | `~/.gemini/config/skills/dbt-bigquery` | Antigravity | `untracked` |
| `discovering-gcp-data-assets` | `~/.gemini/config/skills/discovering-gcp-data-assets` | Antigravity | `untracked` |
| `enforcing-resource-attribution` | `~/.gemini/config/skills/enforcing-resource-attribution` | Antigravity | `untracked` |
| `gcp-data-pipelines` | `~/.gemini/config/skills/gcp-data-pipelines` | Antigravity | `untracked` |
| `gcp-dataflow` | `~/.gemini/config/skills/gcp-dataflow` | Antigravity | `untracked` |
| `gcp-pipeline-orchestration` | `~/.gemini/config/skills/gcp-pipeline-orchestration` | Antigravity | `untracked` |
| `gcp-pipeline-resource-provisioning` | `~/.gemini/config/skills/gcp-pipeline-resource-provisioning` | Antigravity | `untracked` |
| `gcp-spark` | `~/.gemini/config/skills/gcp-spark` | Antigravity | `untracked` |
| `gcp-spark-observability` | `~/.gemini/config/skills/gcp-spark-observability` | Antigravity | `untracked` |
| `gcp-spark-troubleshooting` | `~/.gemini/config/skills/gcp-spark-troubleshooting` | Antigravity | `untracked` |
| `managing-python-dependencies` | `~/.gemini/config/skills/managing-python-dependencies` | Antigravity | `untracked` |
| `ml-best-practices` | `~/.gemini/config/skills/ml-best-practices` | Antigravity | `untracked` |
| `notebook-guidance` | `~/.gemini/config/skills/notebook-guidance` | Antigravity | `untracked` |
| `schema-mapping` | `~/.gemini/config/skills/schema-mapping` | Antigravity | `untracked` |
| `skill-repair` | `~/.gemini/config/skills/skill-repair` | Antigravity | `untracked` |
| `dogfood` | `~/.hermes/skills/dogfood` | Hermes Agent | `untracked` |
| `yuanbao` | `~/.hermes/skills/yuanbao` | Hermes Agent | `untracked` |
