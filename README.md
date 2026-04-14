# ⚒️ VITAE FORGE | Resume Studio

**"Crafting the Future of Professional Identity."**

VITAE FORGE is a premium, open-source visual builder and LaTeX-powered resume generation system. Designed for high-performance career engineering, it combines the flexibility of JSON-based data management with the precision of LaTeX typesetting.

![Version](https://img.shields.io/badge/version-1.0.0--forge-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

---

## ✨ Features

*   **Premium Visual Builder**: Modern, responsive interface with glassmorphism aesthetics.
*   **Monaco Editor Integration**: Advanced "Raw Configuration" mode powered by the VS Code engine.
*   **Recipe System**: Modular configuration to tailor your resume for different roles instantly.
*   **Split-Screen Live Preview**: Side-by-side editing with instant PDF generation.
*   **External LaTeX API**: Seamlessly integrates with the [TexCompiler API](https://github.com/[your-github]/TexCompiler) for zero-local-setup compilation.
*   **Smart Export**: Download PDF, raw LaTeX source, or a self-contained ZIP bundle.
*   **Cloud Sync**: Integrated Cloudflare R2 storage support.

---

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

---

## 📖 Master Configuration Guide

Everything is controlled from a single master file: `configs/resume_config.json`.

### 1. Personal Information (`personal`)
*   **Fields**: Name, Email, Phone, LinkedIn, GitHub.
*   **Requirements**: Use clean professional usernames for LinkedIn/GitHub.

### 2. The Library (`library`)
This is your "Content Database". Reference these items by their ID in your recipes.
*   **Professional Summaries**: Length 250–450 characters. Focus on role-specific impact.
*   **Skills**: Organize by category (e.g., "Web Development"). Use standard industry terms.
*   **Projects**: Use the **STAR** method (Situation, Task, Action, Result). Start bullets with Action Verbs.
*   **Education & Certifications**: Maintain consistency in date formats.

### 3. Recipes (`recipes`)
Recipes define how your final PDFs are built by selecting specific items from the library.
*   **`sections`**: Boolean toggles for top-level layout blocks.
*   **Lists**: Provide an array of **ID strings** from the items in your library.
*   **Ordering**: The order of IDs in your recipe array determines their order on the PDF.

---

## 📏 Single-File Resume Guidelines

Follow these rules to maintain a professional, one-page layout:

| Section | Recommended Count | Length Per Item | Total Space Impact |
| :--- | :--- | :--- | :--- |
| **Professional Summary** | 1 Paragraph | 350 - 500 characters | Moderate |
| **Technical Skills** | 6 - 8 Categories | 4 - 7 keywords per category | High (Vertical) |
| **Projects** | 3 - 4 Projects | 2 - 3 bullet points each | High |
| **Education** | 1 - 2 Entries | 1 - 2 lines total | Low |
| **Certifications** | 4 - 6 Entries | Single line per entry | Moderate |
| **Achievements** | 3 - 4 Entries | Single line per entry | Low |

### 💡 Pro Tips:
*   **Space Saving**: Keep project bullet points to a **single line** in the generated PDF.
*   **Customization**: You can put a full object directly into a recipe to override the library for a specific role.
*   **Visual Balance**: If the resume looks cramped, toggle off a section (like `achievements`) or remove one project.

---

## ⚙️ App Settings

*   **Compiler Config**: Configure your Compiler URL and Type directly in the **App Settings** panel. 
*   **Privacy**: Settings are saved locally in your browser for privacy and convenience.

---

## 📄 License
This project is licensed under the MIT License.

---
*Created with passion by the VITAE FORGE Team.*
