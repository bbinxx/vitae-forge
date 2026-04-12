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
*   `library`: Your master database of projects, skills, and summaries.
*   `recipes`: Definitions for each of your resume roles (Standard, Backend, etc.), which pull from the library via IDs.

### 2. Generator & Builder
*   `scripts/generate.py`: The engine that takes a role ID and the master config to build a custom LaTeX file.
*   `scripts/build.sh`: The one-click automation tool to generate all variants or clean your workspace.

---

## 🛠️ Usage & Operations

### Updating Everything
1.  Open **[`configs/resume_config.json`](file:///media/bbin/MY%20UNIVERSE/DEV/YOUR_NAME_RESUME/configs/resume_config.json)**.
2.  Edit your career history in the `library` section.
3.  Add or tweak a resume role in the `recipes` section.

### Building Locally
Requires `python3` and `pdflatex`.
```bash
./scripts/build.sh          # Build ALL resumes
./scripts/build.sh backend  # Build only the Backend variant
./scripts/build.sh clean    # Wipe temporary files and logs
```
3. Run `./scripts/build.sh newrole` to test locally.
4. Push and tag to deploy:
   ```bash
   git add . && git commit -m "Add new role"
   git tag v1.x.y             # Or resume-v1.x.y
   git push origin dev --tags
   ```
Outputs are always found in the `dist/` folder.

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
