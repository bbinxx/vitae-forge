# 📄 Modular Resume Guidelines

To ensure your resume fits perfectly on a single page while benefiting from the ultra-modular system, follow these content density guidelines.

## 📁 The Core Files

- **`configs/core/data.json`**: This is your master content library. It stores everything (projects, skills, titles, summaries, etc.). Always use unique IDs for items.
- **`configs/core/recipes.json`**: This is the single file that defines all your resume roles. Each role is a list of IDs pointing to the items in the core library.
- **`configs/core/personal.json`**: Stores your common global info (Name, Email, etc.).

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

## 💡 System Usage Tips

### 1. Adding a New Role
You no longer need to create new files. Simply add a new key to the `recipes.json` file. Copy an existing role (like `standard`) as a template and customize the IDs.

### 2. ID Lookup
When you reference an ID (e.g., `"SD"`) in a recipe, the system looks up that key in the `data.json` corresponding section automatically.

### 3. Project Bullet Points
- Use "Action Verb" + "Task" + "Result".
- Keep each bullet point to a **single line** in the PDF to ensure everything fits on one page.

### 4. Overriding Library Content
If you want to use content that isn't in your library for a specific role, you can put the full object or string directly in your `recipes.json`. The generator will prioritize this local content over the library.

---

## 🛠️ Usage Example
1.  Open `configs/core/recipes.json`.
2.  Add a new role key: `"data_science": { ... }`.
3.  Define the project IDs and skill IDs.
4.  Run `./scripts/build.sh data_science`.

---
*Follow these rules to maintain a professional, one-page layout across all generated variants.*
