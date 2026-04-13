# 📄 YOUR NAME — Automated Multi-Role Resume System

> A high-automation, modular LaTeX resume system that generates multiple variants from a **single master configuration file**. Centralized data, two modern templates (Photo & Standard), and zero-touch deployment.

---

## 🚀 System Architecture

This is the ultimate evolution of the modular resume system. Everything—your contact info, your entire career history, and all your resume role recipes—lives in **one single file**.

### 🖼️ Dual-Template Strategy
Every role generates **two** variants automatically:
1.  **Standard (`.pdf`)**: Clean, minimalist, and 100% ATS-friendly.
2.  **Modern (`_X.pdf`)**: A professional layout including your profile photo, optimized for networking.

---

## 🏗️ How it Works

### 1. The "One True File" (`configs/resume_config.json`)
The entire system is powered by this one file, divided into three sections:
*   `personal`: Your name and contact details.
*   `library`: A flattened database of all your reusable content pieces. Each project, skill, and certification has a unique ID (e.g., `"nasa_2024"`).
*   `recipes`: Defines each of your resume roles.
    *   **Item Selection**: Add or remove item IDs from arrays to pull content into a resume (e.g., `"certifications": ["python", "nptel"]`).
    *   `sections`: A nested boolean map to show/hide any top-level layout block (e.g., `"achievements": false`).

### 🛠️ Advanced: Toggle Anything
You can wrap **any** part of the LaTeX templates with `% [SECTION:NAME]` and `% [/SECTION:NAME]` markers. Then, add `"NAME": true/false` to your recipe's `sections` config to toggle that specific block. Currently, this supports:
*   `summary`, `skills`, `projects`, `education`, `certifications`, `achievements`, `languages`, `photo`, and `role_title`.

### 2. Generator & Builder
*   `scripts/generate.py`: The engine that takes a role ID and the master config to build a custom LaTeX file.
*   `scripts/build.sh`: The one-click automation tool to generate all variants or clean your workspace.

---

## 🛠️ Usage & Operations

### Updating Everything
1.  Open **[`configs/resume_config.json`](file:///media/bbin/MY%20UNIVERSE/DEV/YOUR_NAME_RESUME/configs/resume_config.json)**.
2.  Edit your career history in the `library` section.
3.  Add or tweak a resume role in the `recipes` section.

### 🎨 Resume Studio (Visual Dashboard)
A local FastAPI-powered control panel for visual management, live preview, and cloud deployments.
```bash
pip install -r requirements.txt
python scripts/studio.py
```
*   **Live Preview**: View generated PDFs instantly in the browser.
*   **One-Click R2**: Seamlessly sync built resumes to your Cloudflare R2 bucket.
*   **Role Builder**: Build specific roles or "Everything" with a single click.
*   **Clean & Local Access**: Wipe the workspace or open the `dist/` folder directly.

### Building Locally (CLI)
Requires `python3` and `pdflatex`.
```bash
./scripts/build.sh          # Build ALL resumes
./scripts/build.sh backend  # Build only the Backend variant
./scripts/build.sh clean    # Wipe temporary files and logs
```

### Deploying
The CI/CD pipeline dynamically triggers on standard version tags.
1. Commit your config changes:
   ```bash
   git add . && git commit -m "Update SD resume projects"
   ```
2. Tag and push to trigger automated PDF generation:
   ```bash
   ./scripts/tag_version.sh patch   # Auto-generates vX.Y.Z
   git push origin main --tags
   ```
Outputs are always generated into Cloudflare R2 automatically, or found locally in the `dist/` folder.

---

## 📂 Repository Structure
```
.
├── configs/
│   ├── resume_config.json   # THE ONLY FILE YOU NEED TO EDIT
│   └── guidelines.md        # Layout and content tips
├── shared/                  # LaTeX templates
├── scripts/                 # Automation scripts
├── assets/                  # Profile photo
└── dist/                    # Final PDF artifacts (Generated)
```

---
*Built with Python, Bash, and LaTeX · Status: Single-File Configuration*
