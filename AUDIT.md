# Vitae Forge — Full System Audit

> Generated 2026-06-28 (Updated 2026-06-28)

---

## ✅ Resolved Issues (Previous Audit Cleanup)

| Issue | Resolution |
|---|---|
| **Checkpoints feature dead** | Removed `checkpoints.js` + `checkpoint_service.py`. Backup/restore uses DB directly. |
| **`/download/` + `/download-bundle/` routes missing** | Added at `studio.py:165-199`. Both routes serve files from `DIST_DIR`. |
| **`from src.core.firebase import get_settings` broken** | Fixed to use `db.get_settings(user_id)` at `studio.py:263`. |
| **`exportAllPDFs()` not defined** | Removed dead button from `studio.html`. |
| **Duplicate bookmark helpers** | Consolidated `_load_bookmarks`/`_save_bookmarks` — removed `_data` variants. |
| **Duplicate `emit()` inner functions** | Extracted to shared `_sse_emit()` helper. Two copies replaced with `yield _sse_emit(...)`. |
| **`state.trackerData` undefined** | Fixed with optional chaining `state.trackerData?.applications` at `editor.js:44`. |
| **Dead routes** (`stats/summary`, `export-csv`, `all-archived-pdfs`, `bulk-update`, `presigned-url`, `snapshot-resume`) | Removed from `tracker.py` and `studio.py`. |
| **`md5_of_file`, `cps`, `RESUME_CONFIG` unused imports** | Removed. |
| **`annotated-doc` typo in requirements.txt** | Removed. |
| **`seed_user_data = seed_new_user` alias** | Removed. |

---

## 🔒 Security

| Issue | What to do |
|---|---|
| **`.env` contains live R2 + Firebase service account private keys** and is committed. | **Immediately** add `.env` to `.gitignore` if not already, `git rm --cached .env`, create `.env.example` with dummy values. |
| **No `.env.example`** exists to document required env vars (`R2_*`, `FIREBASE_*`, `PASSCODE_*`, `JWT_SECRET`). | **Create** one. |
| **`app.yaml` / `render.yaml` missing required env vars** — no `PASSCODE_ENABLED`, `JWT_SECRET` in deploy configs. | **Add** them. |

---

## 🗑️ Dead Code — Still Present

| What | Where | Why |
|---|---|---|
| **Duplicate merge logic** in `build.py` | `build_custom_version` vs `generate_latex_source` | Nearly identical config merging copied twice. Extract to a helper. |

---

## 🛠️ Quality / Maintenance

| Issue | Fix |
|---|---|
| **`run.bat` breaks with multi-line `.env` values** | The `for /f` loop can't handle Firebase JSON with newlines. Use PowerShell or a Python script to load env. |
| **Inconsistent JS cache-busting** | `main.js` imports with `?v=3`, `tracker.js` imports `api.js` with `?v=4`, while other modules import without. Standardize. |
| **`netlify.toml` hardcoded URL** | `https://your-app.onrender.com` — make configurable or add a note. |
| **Vercel 10s timeout** for LaTeX builds | Add a note that Vercel serverless may timeout on large compiles. |

---

## 🧭 Identity Crisis — Resume Manager or Application Manager?

### Current State
The app is branded as **"Resume Studio"** (title, brand name) but the feature distribution tells a different story:

| Aspect | Resume Manager | Application Manager |
|---|---|---|
| **Tab order** | Dashboard (#1), Saved Resumes (#3), Templates (#4), Library (#5) | Applications (#2) |
| **UI complexity** | Dashboard: simple build/file list sidebar. Resume editing only exists as a sub-view inside the app editor modal. | Full CRUD grid with search/sort/filter, stats bar, inline editing, timeline, interview rounds, version history, custom photo per app. |
| **Where editing happens** | The JSON editor + live preview is inside the **application editor modal** (`tracker.js`). There is no standalone "Edit Resume" tab/page. | Every app gets its own modal with Details, Email, Versions tabs. The resume builder is treated as a **feature of an application**. |
| **Data model** | Recipes (resume configs per role), library (shared entries), bookmarks (saved resume snapshots) | Applications with versions, timeline events, interview rounds, custom photos, archived PDFs |
| **Primary workflow** | Build PDFs from recipes → Upload to cloud → Share | Create/apply to job → Build custom resume version → Save/archive → Track progress |

### Verdict
**It's an application tracker that has a resume builder built in**, not a standalone resume manager. The branding ("Resume Studio") and tab ordering suggest resume-first, but the actual UX weight is on application management.

### Recent Progress
- Dashboard rebuilt with recipe overview grid, stats bar, quick actions per recipe
- Templates tab redesigned to show templates as 2 variants (Standard, Cover Letter) each with a with/without-photo toggle
- Library tab simplified — Personal Info separated from library categories (uses `state.data.personal` not `state.data.library[personal]`)
- Photo upload added to Settings tab
- `GET /photo` and `GET /photo-status` routes added to serve/check profile photo

### Remaining Steps
1. **Move the unified editor + live preview** out of the application modal into its own tab or standalone page
2. **Better differentiate** Saved Resumes (bookmarks) vs Library (data) — currently similar
3. **Merge duplicate merge logic** in `build.py`

---

## 🔌 New API Routes Added

| Route | Method | File | Purpose |
|---|---|---|---|
| `/photo` | GET | `studio.py:179` | Serve profile photo image |
| `/photo-status` | GET | `studio.py:173` | Check if profile photo exists |

---

## 📊 Stats

- **~50 registered routes** (after cleanup)
- **13 JS modules** with `import`/`export` pattern
- **3 HTML templates** (studio, login, share) — all active
- **3 LaTeX templates** (plain, photo, cover_letter) — all active
- **0 broken imports**
