# ⚒️ Vitae Forge

**Vitae Forge** is a professional resume studio designed for building, managing, and compiling LaTeX-based resumes with a modern visual interface. It allows for modular resume configuration via JSON "recipes," enabling you to tailor your resume for different roles instantly.

## 🚀 Features

- **Visual Studio**: A sleek, modern web interface to manage your resume data.
- **Recipe System**: Modular configuration to select specific projects, skills, and summaries for different job roles.
- **Live Preview**: Instant PDF generation and preview.
- **LaTeX Bundler**: Export complete LaTeX source and assets in a ZIP bundle for local compilation or Overleaf.
- **R2 Sync**: Integrated Cloudflare R2 storage support for syncing generated PDFs.

## 📦 Dependencies & Setup

### 1. External LaTeX Compiler API
Vitae Forge does not require a local LaTeX installation. Instead, it relies on an external compilation service:

*   **TexCompiler API**: [https://github.com/[your-github]/TexCompiler](https://github.com/[your-github]/TexCompiler)
    *   This API must be running (locally or hosted) to generate PDFs.
    *   Set the API URL in the **App Settings** panel within the studio or in `configs/settings.json`.

### 2. Local Setup
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/[your-github]/vitae-forge.git
    cd vitae-forge
    ```
2.  **Environment Setup**:
    Initialize the virtual environment and install dependencies:
    ```bash
    ./run.sh
    ```
3.  **Run the Studio**:
    ```bash
    python3 app.py
    ```
    Access the studio at `http://localhost:5000`.

## ⚙️ Configuration

- `configs/resume_config.json`: Master database for all your resume content.
- `configs/settings.json`: System settings (Compiler URL, Compiler Type).
- `templates/`: LaTeX templates used for generation.

## 📄 License
This project is for personal use in building professional resumes.
