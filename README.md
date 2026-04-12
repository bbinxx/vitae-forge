# 📄 Bibin Raju — Automated Multi-Role Resume System

> A high-automation, modular LaTeX resume system that generates multiple variants from consolidated JSON libraries. Centralized data, two modern templates (Photo & Standard), and zero-touch deployment.

---

## 🚀 System Architecture

This system is built for **extreme modularity**. You manage your content in a "Core" library and your resume roles in "Recipe" files.

### 🖼️ Dual-Template Strategy
Every role generates **two** variants automatically:
1.  **Standard (`.pdf`)**: Clean, minimalist, and 100% ATS-friendly.
2.  **Modern (`_X.pdf`)**: A professional layout including your profile photo, optimized for networking.

---

## 🏗️ How it Works

### 1. Core Library (`configs/core/`)
All your career data exists in two central files:
*   `configs/core/personal.json`: Your name, contact info, and social links.
*   `configs/core/data.json`: A unified master database for all your projects, skills, summaries, certifications, and titles.

### 2. Role Recipes (`configs/roles/`)
Each resume (e.g., `backend.json`, `mobile.json`) is a "recipe" file. It lists the **IDs** of the projects, skills, and titles you want to pull from the master library. The generator automatically resolves these IDs into full content.

### 3. Generator & Builder
*   `scripts/generate.py`: Resolves modular IDs and injects them into LaTeX templates.
*   `scripts/build.sh`: Orchestrates the entire PDF generation and cleanup pipeline.

---

## 🛠️ Usage & Operations

### Updating Your Content
1.  **Global Content**: To update a project description globally, edit `configs/core/data.json`.
2.  **Contact Info**: To change your phone or email, edit `configs/core/personal.json`.
3.  **Role Selection**: To change which projects show up on a specific resume, edit the recipe in `configs/roles/`.

### Building Locally
Requires `python3` and `pdflatex` (TeX Live or MiKTeX).
```bash
./scripts/build.sh          # Build ALL resumes
./scripts/build.sh backend  # Build only the Backend role
./scripts/build.sh clean    # Clean up temporary logs and files
./scripts/build.sh help     # Show help message
```
Find your outputs in the `dist/` folder.

### Adding a New Role
1. Create `configs/roles/newrole.json` (copy `template.json`).
2. Reference the IDs from `data.json` for the content you want.
3. Run `./scripts/build.sh newrole` to test locally.

---

## 📂 Repository Structure
```
.
├── configs/            # JSON Libraries & Recipes
│   ├── core/           # Master Data (data.json, personal.json)
│   ├── roles/          # Recipe Files (standard.json, backend.json, etc.)
│   └── guidelines.md   # Content density & system guidelines
├── shared/             # Modern LaTeX templates (Photo & No-Photo)
├── scripts/            # Python generators & Bash automation
├── assets/             # Profile photos & static assets
├── dist/               # Compiled PDF artifacts (Generated)
└── logs/               # Detailed build logs (per variant)
```

---

## 🔗 Connect

| Platform | Link |
|---|---|
| 📧 Email | [bibinraju541@gmail.com](mailto:bibinraju541@gmail.com) |
| 💼 LinkedIn | [linkedin.com/in/bibinraju](https://linkedin.com/in/bibinraju) |
| 🐙 GitHub | [github.com/bbinxx](https://github.com/bbinxx) |

---
*Built with Python, Bash, and LaTeX · Status: Fully Modular & Automated*
