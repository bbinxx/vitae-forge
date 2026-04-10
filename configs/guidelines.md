# 📄 One-Page Resume Guidelines

To ensure your resume fits perfectly on a single page using the LaTeX templates, follow these content density guidelines.

## 📏 Section Limits

| Section | Recommended Count | Length Per Item | Total Space Impact |
| :--- | :--- | :--- | :--- |
| **Professional Summary** | 1 Paragraph | 350 - 500 characters | Moderate |
| **Technical Skills** | 6 - 8 Categories | 4 - 7 keywords per category | High (Veritcal) |
| **Projects** | 3 - 4 Projects | 2 - 3 bullet points each | High |
| **Education** | 1 - 2 Entries | 1 - 2 lines total | Low |
| **Certifications** | 4 - 6 Entries | Single line per entry | Moderate |
| **Achievements** | 3 - 4 Entries | Single line per entry | Low |
| **Additional Info** | 1 - 2 Entries | Single line per entry | Low |

---

## 💡 Pro Tips for a "Perfect Fit"

### 1. The Summary Rule
If your summary exceeds **4 lines** in the generated PDF, it starts pushing projects to the bottom. Keep it punchy: "Role + Key Skills + Major Impact."

### 2. Project Bullet Points
- Use "Action Verb" + "Task" + "Result".
- Try to keep each bullet point to a **single line** in the PDF. Bullet points that wrap to a second line consume double the vertical space.
- Avoid using more than 3 bullet points for minor projects.

### 3. Skill Categorization
Group related skills to save rows. Instead of separate categories for "Frontend" and "UI Tools," combine them if space is tight.

### 4. LaTeX Overrides
In the `education` field, you can use `\vspace{-5pt}` to manually tighten space if you are just a few lines over a page, but use this sparingly as it can break visual balance.

---

## 🛠️ Usage
1. Copy `configs/template.json` to a new file (e.g., `configs/frontend.json`).
2. Fill in the data following the guidelines above.
3. Run `bash scripts/build.sh frontend` to generate and check the PDF.
