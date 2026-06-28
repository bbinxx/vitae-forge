# 📄 Single-File Resume Guidelines

You have reached the ultimate level of system simplicity. Everything is controlled from a single master file.

## 📁 The Master File: `configs/resume_config.json`

This file is structured into three clear sections:
1.  **`personal`**: Shared contact and social data.
2.  **`library`**: Your full career database. Store every project and skill here with unique IDs.
3.  **`recipes`**: Your specific resume roles. Reference IDs from the `library` here.

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

### 1. Minimal Maintenance
To add a new project, add it to the `library` section once. You can then reference its ID in any `recipe` you want.

### 2. Space Saving
Try to keep project bullet points to a **single line** in the generated PDF. This ensures your resume stays on one page.

### 3. Customizing Roles
If you want to deviate from the library for a specific role, you can put the full object (e.g., a custom skill list) directly into the `recipes` section for that role. The system will use the local data instead of looking up an ID.

### 4. Build Command
- `./scripts/build.sh`: Builds every role defined in your config.
- `./scripts/build.sh <role_id>`: Builds just one role (e.g., `./scripts/build.sh backend`).

---
*Follow these rules to maintain a professional, one-page layout across all generated variants.*
