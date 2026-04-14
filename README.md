# ⚒️ VITAE FORGE | Resume Studio

> **"Crafting the Future of Professional Identity."**

VITAE FORGE is a premium, open-source visual builder and LaTeX-powered resume generation system. Designed for high-performance career engineering, it combines the flexibility of JSON-based data management with the precision of LaTeX typesetting.

![Version](https://img.shields.io/badge/version-1.0.0--forge-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## ✨ Features

*   **Premium Visual Builder**: Modern, responsive interface with glassmorphism aesthetics.
*   **Monaco Editor Integration**: Advanced "Raw Configuration" mode powered by the VS Code engine.
*   **Split-Screen Live Preview**: See your changes instantly with side-by-side editing.
*   **External LaTeX API**: Seamlessly integrates with the [TexCompiler API](https://github.com/your-repo/TexCompiler) for zero-local-setup compilation.
*   **Smart Export**: Download high-quality PDF, raw LaTeX source, or a self-contained ZIP bundle.
*   **Mobile-First Design**: Edit and preview your resume on the go with an app-like experience.

## 🚀 Getting Started

### Prerequisites
*   Python 3.12+
*   A running instance of the **TexCompiler API**.

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/vitae-forge.git
    cd vitae-forge
    ```

2.  **Run the automated setup**:
    ```bash
    ./run.sh
    ```
    *This will create a virtual environment, install dependencies, and launch the server.*

3.  **Access the Dashboard**:
    Open [http://127.0.0.1:5051](http://127.0.0.1:5051) in your browser.

## ⚙️ Configuration

Set your local compiler settings in the **App Settings** panel within the UI or manually in `configs/settings.json`:
```json
{
  "compiler_url": "http://localhost:8000",
  "compiler_type": "xelatex"
}
```

## 📂 Project Structure

*   `app.py`: Main FastAPI application server.
*   `generate.py`: Core resume generation engine.
*   `templates/`: HTML and LaTeX templates.
*   `configs/`: Configuration files and role recipes.
*   `dist/`: Build artifacts (PDF, TeX).

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
*Created with passion by VITAE FORGE Team.*
