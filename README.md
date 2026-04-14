# ⚒️ VITAE FORGE | Resume Studio

**"Crafting the Future of Professional Identity."**

VITAE FORGE is a premium, open-source visual builder and LaTeX-powered resume generation system. Designed for high-performance career engineering, it combines the flexibility of JSON-based data management with the precision of LaTeX typesetting.

![Version](https://img.shields.io/badge/version-1.0.0--forge-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## ✨ Features

*   **Premium Visual Builder**: Modern, responsive interface with glassmorphism aesthetics.
*   **Monaco Editor Integration**: Advanced "Raw Configuration" mode powered by the VS Code engine.
*   **Recipe System**: Modular configuration to tailor your resume for different roles instantly.
*   **Split-Screen Live Preview**: Side-by-side editing with instant PDF generation.
*   **External LaTeX API**: Seamlessly integrates with the [TexCompiler API](https://github.com/[your-github]/TexCompiler) for zero-local-setup compilation.
*   **Smart Export**: Download PDF, raw LaTeX source, or a self-contained ZIP bundle.
*   **Cloud Sync**: Integrated Cloudflare R2 storage support.

## 🚀 Getting Started

### Prerequisites
*   Python 3.12+
*   A running instance of the [TexCompiler API](https://github.com/[your-github]/TexCompiler).

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/[your-github]/vitae-forge.git
    cd vitae-forge
    ```
2.  **Run the automated setup**:
    ```bash
    ./run.sh
    ```
    *This will create a virtual environment, install dependencies, and launch the server.*
3.  **Access the Dashboard**:
    Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## ⚙️ Configuration

*   **App Settings**: Configure your Compiler URL and Type directly in the **App Settings** panel. Settings are saved locally in your browser for privacy and convenience.
*   `configs/resume_config.json`: Master database for all your resume content.
*   `templates/`: LaTeX and HTML templates.

## 📄 License
This project is licensed under the MIT License.

---
*Created with passion by the VITAE FORGE Team.*
