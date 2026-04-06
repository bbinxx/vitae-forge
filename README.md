# 📄 Bibin Raju — Automated Multi-Role Resume System

> A high-automation, role-based LaTeX resume system that generates multiple variants from structured JSON configurations. Centralized data, two modern templates (Photo & Standard), and automated deployment to **Cloudflare R2**.

---

## 🚀 System Architecture

This repository has been upgraded to a **Data-Driven Resume System**. You no longer need to edit LaTeX files manually. All your data is stored in `configs/`, and the system handles the rest.

### 🖼️ Preview (Dual Template Strategy)
Every role now generates **two** variants automatically:
1.  **Standard (`.pdf`)**: Clean, minimalist, 100% ATS-friendly.
2.  **Modern (`_X.pdf`)**: Professional layout with a profile photo, best for modern tech portals.

---

## 🛠️ Core Components

*   **📂 `configs/`**: The "Source of Truth". Contains JSON files for each role (`backend.json`, `mobile.json`, `systems.json`, `standard.json`).
*   **🎨 `shared/`**: Contains the core LaTeX templates (`template.tex` and `template_photo.tex`).
*   **⚙️ `scripts/`**:
    *   `generate.py`: The brain that injects JSON data into LaTeX templates.
    *   `build.sh`: Orchestrates the full build process (Generates TeX $\rightarrow$ Compiles PDF $\rightarrow$ Organizes in `dist/`).
    *   `upload_r2.py`: Automatically uploads compiled PDFs to Cloudflare R2.
    *   `tag_version.sh`: Snapshot system for versioning.
*   **🤖 CI/CD**: Every push to `main` triggers a GitHub Action to rebuild and redeploy all resumes.

---

## 🏗️ Usage & Commands

### 1. Update Your Data
Edit the relevant file in `configs/`. All fields (skills, projects, keywords) are fully customizable per role.

### 2. Build Locally
Ensure you have `pdflatex` installed.
```bash
./scripts/build.sh          # Builds ALL roles (Standard & Photo variants)
./scripts/build.sh backend  # Builds only the Backend role
```
Find your compiled PDFs in the `dist/` folder.

### 3. Smart Resume Links (Live)
Resumes are automatically hosted on your custom domain via Cloudflare R2:
*   [resume.bibin.dev/backend](https://resume.bibin.dev/backend)
*   [resume.bibin.dev/backend_X](https://resume.bibin.dev/backend_X) (Photo version)
*   [resume.bibin.dev/systems](https://resume.bibin.dev/systems)
*   [resume.bibin.dev/mobile](https://resume.bibin.dev/mobile)

### 4. Versioning Snapshots
To freeze a version for a specific application or time:
```bash
./scripts/tag_version.sh backend v2026-v1
```

---

## 📁 Repository Structure
```
.
├── configs/            # JSON data per role (Source of Truth)
├── shared/             # LaTeX templates (Photo & No-Photo)
├── scripts/            # Automation (Python & Bash)
├── assets/             # Images & profile photo
├── dist/               # Compiled PDF artifacts (Generated)
├── logs/               # Build failure logs (Generated)
└── .github/workflows/  # CI/CD Pipeline
```

---

## 🔗 Connect

| Platform | Link |
|---|---|
| 📧 Email | [bibinraju541@gmail.com](mailto:bibinraju541@gmail.com) |
| 💼 LinkedIn | [linkedin.com/in/bibinraju](https://linkedin.com/in/bibinraju) |
| 🐙 GitHub | [github.com/bbinxx](https://github.com/bbinxx) |

---
*Built with Python, Bash, and LaTeX · System last updated April 2026*
