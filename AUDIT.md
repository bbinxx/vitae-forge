# Vitae Forge — Full System Audit

> Generated 2026-06-28

---

## 🚨 Critical — Broken

| Issue | What to do |
|---|---|
| **Checkpoints feature dead** — `checkpoints.js` calls `GET/POST /checkpoints`, `POST /checkpoints/{name}/restore`, `DELETE /checkpoints/{name}` but **no backend routes exist**. The `checkpoint_service.py` file exists but is never wired to a router. | Either **remove** the entire checkpoint feature (frontend module `checkpoints.js`, service file, settings UI entries), or **wire up** the missing routes. Recommend **remove** — unused, untested bloat. |
| **`/download/` + `/download-bundle/` routes missing** — `dashboard.js` lines 147-152 call these to download PDF/LaTeX/ZIP from dashboard sidebar. They **404**. | **Add** these download routes or **remove** the buttons from the sidebar HTML. |
| **`from src.core.firebase import get_settings`** — This module (`src/core/firebase.py`) does **not exist**. The `export_pdf_local_route()` will crash at runtime. | **Fix** the import path or **rewrite** that route to use the existing settings system. |
| **`exportAllPDFs()` not defined** — `studio.html:52` calls this onclick but no JS file defines it. Clicking throws `ReferenceError`. | **Define** the function or **remove** the HTML button. |

---

## 🔒 Security

| Issue | What to do |
|---|---|
| **`.env` contains live R2 + Firebase service account private keys** and is committed. | **Immediately** add `.env` to `.gitignore` if not already, `git rm --cached .env`, create `.env.example` with dummy values. |
| **No `.env.example`** exists to document required env vars (`R2_*`, `FIREBASE_*`, `PASSCODE_*`, `JWT_SECRET`). | **Create** one. |
| **`app.yaml` / `render.yaml` missing required env vars** — no `PASSCODE_ENABLED`, `JWT_SECRET` in deploy configs. | **Add** them. |

---

## 🗑️ Dead Code — Remove

| What | Where | Why |
|---|---|---|
| **`checkpoint_service.py`** + **`checkpoints.js`** + checkpoint UI entries | Full stack | Routes don't exist; feature is dead. Either wire up or delete. |
| **`md5_of_file`** import | `studio.py:22` | Imported but never called anywhere. |
| **`cps` import** (`checkpoint_service`) | `studio.py:27` | Imported but never used. |
| **`RESUME_CONFIG` import** | `seed.py:3` | Imported but never referenced. |
| **Dead routes** (no frontend consumer): | `tracker.py` & `studio.py` | Remove: `GET /stats/summary`, `GET /export-csv`, `GET /all-archived-pdfs`, `POST /bulk-update`, `POST/DELETE /snapshot-resume/*`, `GET /presigned-url/*` |
| **Duplicate bookmark helpers** | `studio.py:56-65` vs `286-299` | `_load_bookmarks` / `_save_bookmarks` are identical to `_load_bookmarks_data` / `_save_bookmarks_data`. Consolidate into one. |
| **Duplicate `emit()` inner functions** | `studio.py:311-314` & `427-430` | Same pattern duplicated in export/import backup. Extract to a shared helper. |
| **Duplicate merge logic** in `build.py` | `build_custom_version` (lines 141-161) vs `generate_latex_source` (lines 215-226) | Nearly identical config merging copied twice. Extract to a helper. |
| **`annotated-doc`** in `requirements.txt` | Requirements file | Likely a typo for `annotated-types` (already listed). Remove it. |
| **`seed_user_data = seed_new_user` alias** | `seed.py:40` | Unnecessary. Just call `seed_new_user` directly. |

---

## 🛠️ Quality / Maintenance

| Issue | Fix |
|---|---|
| **`state.trackerData` is undefined** — `editor.js:44` accesses `state.trackerData.applications` but never initialized. `addRoleFromApp()` will crash. | Initialize `trackerData: null` in state or guard the access. |
| **`run.bat` breaks with multi-line `.env` values** | The `for /f` loop can't handle Firebase JSON with newlines. Use PowerShell or a Python script to load env. |
| **Inconsistent JS cache-busting** | `main.js` imports with `?v=3`, `tracker.js` imports `api.js` with `?v=4`, while other modules import without. Standardize. |
| **`netlify.toml` hardcoded URL** | `https://your-app.onrender.com` — make configurable or add a note. |
| **Vercel 10s timeout** for LaTeX builds | Add a note that Vercel serverless may timeout on large compiles. |

---

## 📊 Stats

- **60 registered routes** (3 app + 3 auth + 29 studio + 22 tracker + 7 library)
- **12 JS modules** with `import`/`export` pattern
- **3 HTML templates** (studio, login, share) — all active
- **3 LaTeX templates** (plain, photo, cover_letter) — all active
- **1 broken import** (`from src.core.firebase import get_settings` — module does not exist)
