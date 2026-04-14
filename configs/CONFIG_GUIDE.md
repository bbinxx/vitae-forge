# 📖 Resume Configuration Guide

This guide explains how to manage your master resume configuration file (`resume_config.json`). Follow these guidelines to ensure your resume remains ATS-optimized and visually balanced.

> [!IMPORTANT]
> **LaTeX Compilation**: This project uses the [TexCompiler API](https://github.com/[your-github]/TexCompiler) for PDF generation. Ensure the API URL is correctly configured in your app settings.


---

## 1. Personal Information (`personal`)
*   **Fields**: Name, Email, Phone, LinkedIn, GitHub.
*   **Requirements**: Use clean professional usernames for LinkedIn/GitHub.

## 2. The Library (`library`)
This is your "Content Database". Reference these items by their ID in your recipes.

### 📝 Professional Summaries
*   **Length**: 250 – 450 characters (3–4 lines).
*   **Content**: focus on role-specific impact. Avoid generic "passionate learner".
*   **Requirement**: Must be a single string for each ID.

### 🛠️ Skills
*   **Name**: Category title (e.g., "Web Development").
*   **Keywords**: Comma-separated list.
*   **Length**: Max 8-10 items per row to prevent text wrapping issues.
*   **Optimization**: Use standard industry terms (e.g., "React.js" instead of just "React").

### 🚀 Projects
*   **Name**: Title of the project.
*   **Tech**: Technologies used (max 5-6 items).
*   **Date**: Short month/year format (e.g., "Dec 2024").
*   **Points**:
    *   **Count**: 3–4 bullets per project.
    *   **Length**: Each bullet should be 100–180 characters.
    *   **Method**: Use the **STAR** (Situation, Task, Action, Result) method. Always start with an Action Verb (e.g., "Engineered", "Optimized").

### 📜 Certifications & Achievements
*   **Issuer**: Full name of the institution.
*   **Year**: Year or Month/Year.
*   **Count**: Max 5 certifications per resume to keep it to one page.

---

## 3. Recipes (`recipes`)
Recipes define how your final PDFs are built.

*   **`sections`**: Boolean toggles for top-level layout blocks.
*   **Lists**: Provide an array of **ID strings** from the items in your library.
*   **Ordering**: The order of IDs in your recipe array determines the order they appear on the PDF.

---

## ⚖️ Visual Balance Requirements
1.  **Page Count**: Aim for exactly **1 page**.
2.  **White Space**: If the resume looks cramped, toggle off a section (like `achievements`) or remove 1 project.
3.  **Consistency**: Ensure all dates follow the same format (either "2024" or "Dec 2024").
