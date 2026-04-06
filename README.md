# 📄 YOUR NAME — Automated Multi-Role Resume System

> A high-automation, modular LaTeX resume system that generates multiple variants from structured JSON configurations. Centralized data, two modern templates (Photo & Standard), and zero-touch deployment to **Cloudflare R2**.

---

## 🚀 System Architecture

This system is built for **content-driven resume management**. You no longer need to touch LaTeX code to update your career history. All data is managed in `configs/`, and the pipeline handles the rest.

### 🖼️ Dual-Template Strategy
Every role generates **two** variants automatically:
1.  **Standard (`.pdf`)**: Clean, minimalist, and 100% ATS-friendly.
2.  **Modern (`_X.pdf`)**: A professional layout including your profile photo, optimized for networking and modern portals.

---

## 🏗️ How it Works

### 1. Data-to-PDF Generation
The `scripts/generate.py` script parses your role-specific JSON (e.g., `backend.json`) and injects the data into one of the core templates in `shared/`. It handles everything from skill categorization to project formatting.

### 2. Multi-Variant Build
The `scripts/build.sh` script orchestrates the entire process:
- Iterates through all roles in `configs/`.
- Generates both **Standard** and **Photo** TeX files.
- Compiles them using `pdflatex`.
- Moves the final artifacts to the `dist/` directory.

### 3. Automated Deployment (CI/CD)
The system uses **GitHub Actions** for safe, versioned releases:
- **Trigger**: The pipeline only runs when you push a new version tag (e.g., `git tag resume-v1.2.0`).
- **Validation**: It verifies the LaTeX build before proceeding.
- **Upload**: Successfully built PDFs are pushed to **Cloudflare R2** with the correct MIME types.

---

## 🛠️ Usage & Operations

### Updating Your Resumes
Simply edit the relevant JSON file in `configs/`. You can change titles, skills, or even the order of projects without touching any styling code.

### Building Locally
Requires `python3` and `pdflatex` (TeX Live or MiKTeX).
```bash
./scripts/build.sh          # Build ALL roles and variants
./scripts/build.sh backend  # Build only the Backend role
```
Find your outputs in the `dist/` folder.

### Adding a New Role
1. Create `configs/newrole.json` (copy an existing one).
2. Fill in your data.
3. Run `./scripts/build.sh newrole` to test locally.
4. Push and tag to deploy:
   ```bash
   git add . && git commit -m "Add new role"
   git tag resume-v1.x.y
   git push origin main --tags
   ```

---

## ☁️ Live Resume Links
Your resumes are automatically hosted on your custom domain. The system **keeps the .pdf extension** for better browser compatibility:

- **Backend**: [bibin.dev/resume/backend.pdf](https://resume.bibin.dev/backend.pdf) | [With Photo](https://resume.bibin.dev/backend_X.pdf)
- **Mobile**: [bibin.dev/resume/mobile.pdf](https://resume.bibin.dev/mobile.pdf) | [With Photo](https://resume.bibin.dev/mobile_X.pdf)
- **Systems**: [bibin.dev/resume/systems.pdf](https://resume.bibin.dev/systems.pdf) | [With Photo](https://resume.bibin.dev/systems_X.pdf)

---

## 📂 Repository Structure
```
.
├── configs/            # JSON data per role (Source of Truth)
├── shared/             # Modern LaTeX templates (Photo & No-Photo)
├── scripts/            # Python generators & Bash automation
├── assets/             # Profile photos & static assets
├── dist/               # Compiled PDF artifacts (Generated)
└── .github/workflows/  # CI/CD (Tag-based deployment)
```

---

## ⚙️ Configuration (GitHub Secrets)
To enable automated deployment, add these secrets to your repository:
- `R2_ACCESS_KEY_ID`: Your Cloudflare API key.
- `R2_SECRET_ACCESS_KEY`: Your Cloudflare secret key.
- `R2_ENDPOINT_URL`: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `R2_BUCKET_NAME`: Your target bucket name.

---

## 🔗 Connect

| Platform | Link |
|---|---|
| 📧 Email | [your.email@example.com](mailto:your.email@example.com) |
| 💼 LinkedIn | [linkedin.com/in/your-linkedin](https://linkedin.com/in/your-linkedin) |
| 🐙 GitHub | [github.com/your-github](https://github.com/your-github) |

---
*Built with Python, Bash, and LaTeX · Status: Live & Automated*
