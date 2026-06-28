# Vitae Forge

A multi-tenant LaTeX resume builder and job application tracker with cloud sync, concurrent compilation, and a professional web dashboard.

---

## Features

- **Modular Resume System** — Reusable content library with role-based recipes. Each role generates two variants: standard (ATS-friendly) and modern (with profile photo).
- **Job Application Tracker** — Full pipeline management with status timelines, interview rounds, salary tracking, and per-application resume versions.
- **Cloud Sync** — Firebase Firestore for data, Cloudflare R2 for PDF storage with pre-signed sharing URLs.
- **Concurrent Builds** — Thread-pool compilation across CPU cores via `pdflatex`.
- **Authentication** — JWT-based passcode protection with cookie middleware.
- **Live Preview** — Generate PDF previews directly in the browser without saving.

---

## Quick Start

### Prerequisites

- Python 3.14+
- A LaTeX distribution (`pdflatex` — TeX Live recommended)
- Firebase service account (for cloud data)
- Cloudflare R2 credentials (for PDF storage)

### Local Development

```bash
# Clone the repository
git clone https://github.com/[your-github]/vitae-forge.git
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

# Firebase
FIREBASE_CREDENTIALS_PATH=/path/to/service-account.json
# OR
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket
```

See [`configs/CONFIG_GUIDE.md`](configs/CONFIG_GUIDE.md) for detailed configuration options.

---

## Project Structure

```
.
├── src/
│   ├── api/            # FastAPI routers (auth, studio, tracker, library)
│   ├── core/           # Build engine, LaTeX generation, cloud upload
│   ├── db/             # Repository pattern (Firestore, seed data)
│   └── services/       # Business logic (resume, tracker, checkpoint)
├── templates/
│   ├── tex/            # LaTeX templates (plain, photo, cover letter)
│   ├── studio.html     # Main dashboard
│   ├── login.html      # Auth page
│   └── share.html      # Public resume viewer
├── configs/            # Resume config templates and guides
├── static/             # CSS, JS assets
├── prompts/            # AI prompt templates
├── Dockerfile          # Production container
├── docker-compose.yml  # Local Docker dev
└── requirements.txt    # Python dependencies
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate and receive JWT |
| POST | `/api/auth/register` | Create new user account |
| GET | `/api/get-config` | Fetch full resume config |
| POST | `/api/save-config` | Save resume config |
| POST | `/api/preview-pdf` | Generate live PDF preview |
| GET | `/build/{role}` | Build a specific role (stream) |
| GET | `/applications` | List all job applications |
| POST | `/applications` | Create new application |
| GET | `/applications/stats/summary` | Dashboard statistics |

---

## Deployment

Supported platforms:

| Platform | Config File | Status |
|----------|-------------|--------|
| Docker / GHCR | `Dockerfile` + `cd.yml` | Primary |
| DigitalOcean App Platform | `app.yaml` | Supported |
| Render | `render.yaml` | Supported |
| Vercel | `vercel.json` | Frontend only |
| Netlify | `netlify.toml` | Static frontend only |

### CI/CD

- **CI** (`.github/workflows/ci.yml`) — Runs flake8 linting on push to `main`/`dev` and PRs to `main`.
- **CD** (`.github/workflows/cd.yml`) — Builds and pushes Docker image to GHCR on version tags (`v*`).

---

## License

[MIT](LICENSE)
