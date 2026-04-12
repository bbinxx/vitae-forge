# 📄 Modular Resume Guidelines

To ensure your resume fits perfectly on a single page while benefiting from the modular system, follow these content density guidelines.

## 📁 Repository Organization

- **`configs/core/data.json`**: This is your master content library. It stores everything (projects, skills, titles, summaries, etc.). Always use unique IDs for items.
- **`configs/core/personal.json`**: Stores your common global info like Name, Email, and social links.
- **`configs/roles/`**: Contains your specific role recipes. These files point to the IDs in the core library.

---

## 📏 Section Limits (Per One Page)

| Section | Recommended Count | Length Per Item | Total Space Impact |
| :--- | :--- | :--- | :--- |
| **Professional Summary** | 1 Paragraph | 350 - 500 characters | Moderate |
| **Technical Skills** | 6 - 8 Categories | 4 - 7 keywords per category | High (Vertical) |
| **Projects** | 3 - 4 Projects | 2 - 3 bullet points each | High |
| **Education** | 1 - 2 Entries | 1 - 2 lines total | Low |
| **Certifications** | 4 - 6 Entries | Single line per entry | Moderate |
| **Achievements** | 3 - 4 Entries | Single line per entry | Low |

---

## 💡 Content Management Tips

### 1. The ID Lookup Rule
When you put `"SD"` or `"will_it_rain"` in a role configuration, the system looks up that key in the `data.json` corresponding section. 

### 2. Tailoring for Roles
In `data.json`, you can maintain different versions of skills or summaries for different seniority levels or roles. Just reference the appropriate ID in your role resume recipe.

### 3. Project Bullet Points
- Use "Action Verb" + "Task" + "Result".
- Try to keep each bullet point to a **single line** in the PDF to maximize space.

### 4. Direct Overrides
If you want to deviate from the library for just one specific resume, you can put the full object (e.g., a dictionary for a project) directly in your `role.json`. The generator will prioritize this local content over the core library.

---

## 🛠️ Typical Workflow
1.  Add a new project or credential to `configs/core/data.json`.
2.  Open your role recipe in `configs/roles/` (e.g., `standard.json`).
3.  Add the new ID to the relevant list.
4.  Build and verify: `./scripts/build.sh standard`.

---
*Follow these rules to maintain a professional, one-page layout across all generated variants.*
