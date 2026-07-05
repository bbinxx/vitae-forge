# Vitae Forge

> A multi-tenant LaTeX resume builder and job application tracker with cloud sync, concurrent compilation, and a professional web dashboard.

---

## Features

- **Modular Resume System** — Reusable content library with role-based recipes. Each role generates two variants: standard (ATS-friendly) and modern (with profile photo).
- **Job Application Tracker** — Full pipeline management with status timelines, interview rounds, salary tracking, and per-application resume versions.
- **Cloud Sync** — Firebase Firestore for data, Cloudflare R2 for PDF storage with pre-signed sharing URLs.
- **Concurrent Builds** — Thread-pool compilation across CPU cores via `pdflatex`.
- **Authentication** — JWT-based passcode protection with cookie middleware.
- **Live Preview** — Generate PDF previews directly in the browser without saving.
- **AI-Assisted** — Built-in job URL scraper and ATS optimization prompt for AI-powered resume tailoring.
- **Cross-Platform** — Start scripts for Linux, macOS, and Windows.

---

## Quick Start

### Prerequisites

- Python 3.14+
- A LaTeX distribution (`pdflatex` — [TeX Live](https://tug.org/texlive/) recommended)
- Firebase service account (for cloud data)
- Cloudflare R2 credentials (for PDF storage)

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-github/vitae-forge.git
cd vitae-forge

# Run the start script (handles venv, deps, and launch)
./run.sh        # Linux / macOS
run.bat         # Windows
```

The dashboard will be available at `http://127.0.0.1:5050`.

### Docker

```bash
docker compose up --build
```

---

## Configuration

Create a `.env` file in the project root:

```env
# Auth
JWT_SECRET=your-secret-key
PASSCODE_HASH=bcrypt-hash-of-passcode
PASSCODE_ENABLED=true

# Firebase (choose one)
FIREBASE_CREDENTIALS_PATH=/path/to/service-account.json
# OR
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | `super-secret-default-key-change-in-prod` | Secret key for JWT signing |
| `PASSCODE_HASH` | No | — | bcrypt hash of application passcode |
| `PASSCODE_ENABLED` | No | `true` | Toggle passcode protection |
| `FIREBASE_CREDENTIALS_PATH` | No | — | Path to Firebase service account JSON |
| `FIREBASE_SERVICE_ACCOUNT` | No | — | Inline JSON of Firebase credentials |
| `R2_ACCOUNT_ID` | Yes | — | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Yes | — | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | — | R2 secret key |
| `R2_BUCKET_NAME` | No | `dev-n1` | R2 bucket name |

See [`configs/CONFIG_GUIDE.md`](configs/CONFIG_GUIDE.md) for detailed configuration options.

---

## Project Structure

```
.
├── src/
│   ├── app.py                  # FastAPI entry point, middleware, static mounts
│   ├── api/
│   │   ├── auth.py             # JWT login, register, /me
│   │   ├── studio.py           # Build, bookmarks, config, snapshots, share
│   │   ├── tracker.py          # Job applications, versions, CSV export
│   │   └── library.py          # Library sections, items, recipes CRUD
│   ├── core/
│   │   ├── config.py           # Project paths, pdflatex discovery
│   │   ├── generate.py         # LaTeX resume generator from JSON config
│   │   ├── build.py            # Build orchestrator (concurrent pdflatex)
│   │   └── upload.py           # Cloudflare R2 upload helpers
│   ├── db/
│   │   ├── repository.py       # Abstract repository interface
│   │   ├── firestore_repo.py   # Firestore implementation
│   │   └── seed.py             # Default data seeding from template
│   └── services/
│       ├── resume_service.py   # Config merge/save, library CRUD
│       ├── user_service.py     # User auth, registration
│       ├── tracker_service.py  # App defaults, display names, timeline

├── templates/
│   ├── tex/
│   │   ├── template.tex        # Plain ATS-friendly resume
│   │   ├── template_photo.tex  # Photo variant (two-column header)
│   │   └── cover_letter.tex    # Cover letter template
│   ├── studio.html             # Main dashboard SPA
│   ├── login.html              # Auth page
│   └── share.html              # Public resume viewer
├── static/
│   ├── css/studio.css          # Dashboard stylesheet
│   └── js/                     # Frontend modules (14 files)
├── configs/
│   ├── resume_config.template.json  # Default resume config
│   ├── CONFIG_GUIDE.md         # Configuration documentation
│   └── guidelines.md           # Resume writing guidelines
├── prompts/
│   └── ATS_Prompt.md           # AI prompt for ATS-optimized resume generation
├── .github/workflows/
│   ├── ci.yml                  # Lint on push/PR
│   └── cd.yml                  # Docker build on version tags
├── Dockerfile                  # Production container (Python 3.14 + TeX Live)
├── docker-compose.yml          # Local Docker dev
├── requirements.txt            # Python dependencies
├── run.sh                      # Linux/macOS start script
├── run.bat                     # Windows start script
├── LICENSE                     # MIT
└── README.md
```

---

## Data Model

### Firestore Schema

```
users/{user_id}
├── username, password_hash
│
├── resume_data/personal        # Name, email, phone, LinkedIn, GitHub
├── resume_data/library         # Reusable content (skills, projects, education, etc.)
├── resume_data/recipes         # Named resume configurations
├── resume_data/settings        # User preferences (file prefix, export folder)
│
├── applications/{app_id}       # Job applications
│   ├── company, role, status, priority, timeline[], interview_rounds[]
│   ├── resume_template         # Per-app resume JSON config
│   ├── assigned_pdf, archived_pdf
│   └── versions/{v_id}         # Custom resume versions per application
│       ├── customizations, base_recipe
│       └── pdf_r2_key, photo_r2_key
│
└── checkpoints/{name}          # (internal — backup/restore only)
    └── config                  # Full resume config snapshot
```

### Application Statuses

`Bookmarked` → `Applied` → `Screening` → `Interview` → `Offer` | `Rejected` | `Withdrawn`

---

## API Reference

### Authentication (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate with username/password, returns JWT |
| POST | `/api/auth/register` | Create account and seed default data |
| GET | `/api/auth/me` | Get current user profile |

### Studio (`/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/get-config` | Fetch full resume config (personal + library + recipes) |
| POST | `/save-config` | Save full resume config |
| POST | `/compile-direct` | Compile PDF from ad-hoc config |
| POST | `/download-latex-direct` | Download generated .tex source |
| POST | `/download-zip-direct` | Download ZIP bundle (tex + photo + instructions) |
| POST | `/snapshot-resume` | Create one-off recipe from base + customizations |
| DELETE | `/snapshot-resume/{key}` | Delete a snapshot recipe |
| GET | `/build/{role}` | Stream build output for a role (or `all`) |
| GET | `/upload/{filename}` | Upload single PDF to R2 |
| POST | `/upload-all` | Upload all PDFs to R2 concurrently |
| GET | `/presigned-url/{filename}` | Get 7-day presigned R2 URL |
| GET | `/list-files` | List all PDFs in R2 with display names |
| GET | `/cloud-pdf/{key}` | Redirect to presigned R2 URL |
| GET | `/share/{filename}` | Render public HTML share page |
| POST | `/api/preview-pdf` | Generate temporary preview PDF (no save) |
| GET | `/api/template/{filename}` | Get raw LaTeX template content |
| POST | `/api/r2-backup` | Upload config/template ZIP to R2 |
| GET | `/api/settings` | Get user settings |
| POST | `/api/settings` | Save user settings |
| GET | `/api/settings/pick-folder` | Native folder picker (zenity) |
| POST | `/api/export-pdf-local` | Copy PDF to local export folder |

### Bookmarks (`/bookmarks`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/bookmarks` | List all saved bookmarks |
| POST | `/bookmarks` | Create bookmark |
| DELETE | `/bookmarks/{id}` | Delete bookmark |
| POST | `/bookmarks/{id}/compile-pdf` | Compile bookmark to PDF |
| GET | `/bookmarks/{id}/download-latex` | Download bookmark .tex |
| GET | `/bookmarks/{id}/download-zip` | Download bookmark ZIP |

### Library (`/api/library`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/library/{section}` | Get entire library section |
| GET | `/api/library/{section}/{key}` | Get single library item |
| POST | `/api/library/{section}/{key}` | Create/update library item |
| DELETE | `/api/library/{section}/{key}` | Delete library item |
| GET | `/api/library/recipes/all` | Get all resume recipes |
| POST | `/api/library/recipes/{id}` | Create/update recipe |
| DELETE | `/api/library/recipes/{id}` | Delete recipe |

### Job Tracker (`/applications`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications` | List all applications |
| POST | `/applications` | Create application (optionally compiles resume) |
| PUT | `/applications/{id}` | Update application (status change → timeline event) |
| DELETE | `/applications/{id}` | Delete application |
| POST | `/applications/bulk-update` | Bulk-update multiple applications |
| GET | `/applications/stats/summary` | Dashboard stats (by status, priority) |
| GET | `/applications/export-csv` | Export all applications as CSV |
| GET | `/applications/all-archived-pdfs` | List unique archived PDF keys |
| POST | `/applications/{id}/timeline` | Add timeline event |
| POST | `/applications/{id}/interview-rounds` | Add interview round |
| DELETE | `/applications/{id}/interview-rounds/{rid}` | Delete interview round |
| GET | `/applications/{id}/versions` | List resume versions |
| POST | `/applications/{id}/versions` | Create resume version |
| PUT | `/applications/{id}/versions/{vid}` | Update version customizations |
| DELETE | `/applications/{id}/versions/{vid}` | Delete version |
| POST | `/applications/{id}/photo` | Upload custom photo to R2 |
| GET | `/applications/{id}/versions/{vid}/build` | Build version PDF, upload to R2 |
| GET | `/applications/{id}/versions/{vid}/pdf` | Redirect to version PDF |
| POST | `/applications/{id}/versions/{vid}/assign` | Set version as active resume |
| GET | `/applications/{id}/archived-resume` | Redirect to archived PDF |
| POST | `/applications/{id}/compile-pdf` | Compile and save PDF from config |
| POST | `/applications/scrape-job-url` | Scrape job URL, return AI prompt |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (SPA)                  │
│   studio.html  +  14 JS modules  +  CSS         │
└──────────────────────┬──────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────┐
│              FastAPI (src/app.py)                │
│  ┌──────────┬──────────┬──────────┬───────────┐ │
│  │  auth    │  studio  │ tracker  │ library   │ │
│  └────┬─────┴────┬─────┴────┬─────┴─────┬─────┘ │
│       │          │          │           │        │
│  ┌────▼──────────▼──────────▼───────────▼─────┐  │
│  │              Services Layer                │  │
│  └────┬──────────┬──────────┬────────────────┘  │
│       │          │          │                    │
│  ┌────▼────┐ ┌───▼────┐ ┌──▼────────────────┐  │
│  │Firestore│ │  R2    │ │  Build Engine     │  │
│  │   DB    │ │ Cloud  │ │  pdflatex × N     │  │
│  └─────────┘ └────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## LaTeX Templates

Each resume generates two PDF variants:

| Variant | Template | Description |
|---------|----------|-------------|
| Standard | `template.tex` | Clean, ATS-friendly, single-column |
| Photo | `template_photo.tex` | Two-column header with profile photo |

### Template Placeholders

| Placeholder | Section |
|-------------|---------|
| `<<NAME>>` | Header — full name |
| `<<ROLE_TITLE>>` | Header — target role |
| `<<EMAIL>>` | Header — email address |
| `<<PHONE>>` | Header — phone number |
| `<<LINKEDIN>>` | Header — LinkedIn username |
| `<<GITHUB>>` | Header — GitHub username |
| `<<SUMMARY>>` | Professional Summary |
| `<<SKILLS>>` | Skills (tabular) |
| `<<PROJECTS>>` | Projects |
| `<<EDUCATION>>` | Education |
| `<<CERTIFICATIONS>>` | Certifications (table) |
| `<<ACHIEVEMENTS>>` | Achievements (table) |
| `<<ADDITIONAL>>` | Additional Information |

### Cover Letter

| Placeholder | Section |
|-------------|---------|
| `<<COMPANY_NAME>>` | Company being addressed |
| `<<COVER_LETTER>>` | Letter body |

---

## Deployment

Please see the comprehensive [**Deployment Guide** (`DEPLOYMENT.md`)](DEPLOYMENT.md) for detailed, step-by-step instructions on deploying Vitae Forge to various cloud platforms.

| Platform | Config | Notes |
|----------|--------|-------|
| Docker / GHCR | `Dockerfile` + `.github/workflows/cd.yml` | Primary — auto-builds on `v*` tags |
| DigitalOcean | `app.yaml` | App Platform (Docker) |
| Render | `render.yaml` | Docker service (Recommended) |
| Vercel | `vercel.json` | Serverless API / UI (No PDF generation) |
| Netlify | `netlify.toml` | Static frontend proxy to Render |

### CI/CD

- **CI** (`.github/workflows/ci.yml`) — Runs flake8 linting on push to `main`/`dev` and PRs to `main`.
- **CD** (`.github/workflows/cd.yml`) — Builds and pushes Docker image to GHCR on version tags (`v*`).

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable — mirrors `dev` after review |
| `dev` | Active development |

### Tagging

```
v2.2.0  — Current (Dashboard overhaul, Cloud Photo, Backup Import/Export)
v2.0.0  — (src/ restructure, CI/CD, Docker, multi-platform deploy)
```

---

## AI Prompt System

The `prompts/ATS_Prompt.md` file contains a structured AI prompt for generating ATS-optimized resumes from job descriptions. Usage:

1. Copy the prompt from `prompts/ATS_Prompt.md`
2. Paste into an AI assistant (ChatGPT, Claude, Gemini)
3. Include the job description
4. The AI returns a structured JSON that can be imported directly into the application tracker

---

## License

[MIT](LICENSE)
