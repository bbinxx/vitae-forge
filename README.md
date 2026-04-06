# 📄 YOUR NAME — Multi-Role Resume

> A modular, variant-based LaTeX resume system with **automated** PDF/Preview generation. This repository serves as a central hub for role-specific resumes, currently optimized for **General Development**, **Backend Engineering**, **Systems Engineering**, and **Mobile Application Development**.

## ⚡ Preview (Auto-Updated)

![Resume Preview](./assets/preview.png?raw=true)

---

## 📁 Repository Structure

The project is organized into self-contained folders for different professional roles. Each folder contains its own LaTeX source files and assets.

```
.
├── roles/              # Role-specific variations
│   ├── standard/       # Default Resume (Standard Baseline)
│   ├── backend/        # Backend Engineer Variant
│   ├── systems/        # Systems / Go / Rust Variant
│   └── mobile/         # Mobile Application Developer Variant
├── assets/             # Common Assets (Photos, Previews)
├── scripts/            # Automation & Utility Scripts
└── README.md           # Documentation
```

---

## 🛠️ Usage & Automation

### 1. Watch Mode (Real-time Preview)
If you want to see your changes update the `preview.png` in real-time as you save:
```bash
# General syntax: ./scripts/watch_preview.sh [path_to_tex]
./scripts/watch_preview.sh roles/standard/YOUR_NAME_Raju_Resume.tex
```

### 2. PDF & Release Automation
*   **Automatic Compilation**: Every commit to the `main` branch triggers a GitHub Action that compiles your default resume (`roles/standard/YOUR_NAME_Raju_Resume.tex`) and updates the preview image.
*   **GitHub Releases**: Each push to `main` automatically updates a [latest release](https://github.com/your-github/resume/releases/tag/latest) containing the compiled PDF.

### 3. Data Extraction (JSON)
Convert your LaTeX content into structured JSON for ATS or web integrations:
```bash
RESUME_TEX=roles/standard/YOUR_NAME_Raju_Resume.tex python3 scripts/to_json.py
```

### 4. Bulk Export Resumes
Quickly compile and export all or specific resumes to a custom folder:
```bash
./scripts/export_resumes.sh
```
This script will interactively ask which roles you want to compile and where to save the PDFs.

---

## 🏗️ Build Instructions

### Prerequisites
Ensure you have a LaTeX distribution installed:
- **Linux**: `sudo apt install texlive-full`
- **macOS**: [MacTeX](https://www.tug.org/mactex/)
- **Windows**: [MiKTeX](https://miktex.org/)

### Manual Compilation
To compile a specific variant, navigate to its directory and run `pdflatex`:
```bash
cd roles/backend
pdflatex YOUR_NAME_Raju_BE_Resume.tex
```

---

## ✏️ Customization

To update your details, simply edit the `.tex` files in the desired subfolder. All variants are self-contained and ready to compile independently.

| Format | Identifier | Use Case |
|---|---|---|
| **Classic** | (Main name) | Best for ATS compatibility and traditional applications. |
| **Visual** | `*_X.tex` | Professional layout with photo, best for modern tech portals. |

---

## 📦 Download Latest
[![Download latest PDF](https://img.shields.io/badge/Download-Latest_Resume-blue?logo=adobeacrobatreader)](https://github.com/your-github/resume/releases/tag/latest)

---

## 🔗 Connect

| Platform | Link |
|---|---|
| 📧 Email | [your.email@example.com](mailto:your.email@example.com) |
| 💼 LinkedIn | [linkedin.com/in/your-linkedin](https://linkedin.com/in/your-linkedin) |
| 🐙 GitHub | [github.com/your-github](https://github.com/your-github) |

---

*Built with LaTeX · System last updated April 2026*
