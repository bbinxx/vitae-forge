# 📄 Bibin Raju — Multi-Role Resume

> A modular, variant-based LaTeX resume system with **automated** PDF/Preview generation. This repository serves as a central hub for role-specific resumes, currently optimized for **General Development**, **Backend Engineering**, and **Systems Engineering**.

## ⚡ Preview (Auto-Updated)

![Resume Preview](./assets/preview.png?raw=true)

---

## 📁 Repository Structure

The project is organized into self-contained folders for different professional roles. Each folder contains its own LaTeX source files and assets.

```
.
├── standard/           # Default Resume (Standard Baseline)
│   ├── Bibin_Raju_Resume.tex       # Classic text-only layout
│   └── Bibin_Raju_Resume_X.tex     # Visual layout with profile photo
├── backend/            # Backend Engineer Variant
│   ├── Bibin_Raju_BE_Resume.tex    # Classic text-only layout
│   └── Bibin_Raju_BE_Resume_X.tex  # Visual layout with profile photo
├── systems/            # Systems / Go / Rust Variant
│   ├── Bibin_Raju_SE_Resume.tex    # Classic text-only layout
│   └── Bibin_Raju_SE_Resume_X.tex  # Visual layout with profile photo
├── assets/             # Common Assets
│   ├── preview.png        # Auto-generated preview for README
│   └── profile-photo.jpg  # Master profile image
├── scripts/            # Automation & Utility Scripts
└── README.md           # Documentation
```

---

## 🛠️ Usage & Automation

### 1. Watch Mode (Real-time Preview)
If you want to see your changes update the `preview.png` in real-time as you save:
```bash
# General syntax: ./scripts/watch_preview.sh [path_to_tex]
./scripts/watch_preview.sh standard/Bibin_Raju_Resume.tex
```

### 2. PDF & Release Automation
*   **Automatic Compilation**: Every commit to the `main` branch triggers a GitHub Action that compiles your default resume (`standard/Bibin_Raju_Resume.tex`) and updates the preview image.
*   **GitHub Releases**: Each push to `main` automatically updates a [latest release](https://github.com/bbinxx/resume/releases/tag/latest) containing the compiled PDF.

### 3. Data Extraction (JSON)
Convert your LaTeX content into structured JSON for ATS or web integrations:
```bash
RESUME_TEX=standard/Bibin_Raju_Resume.tex python3 scripts/to_json.py
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
cd backend
pdflatex Bibin_Raju_BE_Resume.tex
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
[![Download latest PDF](https://img.shields.io/badge/Download-Latest_Resume-blue?logo=adobeacrobatreader)](https://github.com/bbinxx/resume/releases/tag/latest)

---

## 🔗 Connect

| Platform | Link |
|---|---|
| 📧 Email | [bibinraju541@gmail.com](mailto:bibinraju541@gmail.com) |
| 💼 LinkedIn | [linkedin.com/in/bibinraju](https://linkedin.com/in/bibinraju) |
| 🐙 GitHub | [github.com/bbinxx](https://github.com/bbinxx) |

---

*Built with LaTeX · System last updated April 2026*
