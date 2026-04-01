# 📄 YOUR NAME — Resume

> A clean, professional single-page LaTeX resume with **automated** PDF/Preview generation.

## ⚡ Preview (Auto-Updated)

![Resume Preview](./preview.png?raw=true)

---

## 🚀 Live Preview & Automation

Thinking about a **truly live** flow?

1.  **Automatic Updates**: Every time you `git push` to `main`, a [GitHub Action](.github/workflows/compile.yml) automatically compiles your `.tex` and updates `main.pdf` and `preview.png` in the repo.
2.  **Local Watch Mode**: If you want to see changes update `preview.png` as you save `main.tex`:
    ```bash
    chmod +x scripts/watch_preview.sh
    ./scripts/watch_preview.sh
    ```
    *This will watch your files and update the preview image in your local README environment whenever you save.*

---

## 📁 Repository Structure

```
.
├── main.tex           # LaTeX source file
├── main.pdf           # Compiled resume (PDF)
├── profile-photo.jpg  # Profile photo used in the header
├── preview.png        # PDF preview image (auto-generated)
└── README.md          # This file
```

---

## 🛠️ Build Instructions

### Prerequisites

Make sure you have a LaTeX distribution installed:

- **Linux**: `sudo apt install texlive-full` (or `texlive-latex-extra`)
- **macOS**: Install [MacTeX](https://www.tug.org/mactex/)
- **Windows**: Install [MiKTeX](https://miktex.org/)

### Compile

```bash
# Using pdflatex
pdflatex main.tex

# Or using latexmk (recommended — handles multi-pass automatically)
latexmk -pdf main.tex
```

The compiled `main.pdf` will appear in the same directory.

### Clean build artifacts

```bash
latexmk -C
```

---

## ✏️ Customization

Edit `main.tex` to update:

| Section | Description |
|---|---|
| Header | Name, email, phone, LinkedIn, GitHub, photo |
| Objective | Short professional summary |
| Skills | Languages, frameworks, tools, deployment |
| Projects | Project title, tech stack, date, GitHub link, bullet points |
| Education | Degree, institution, university, years |
| Certifications | Certificate name, issuer, year |
| Achievements | Awards and recognitions |
| Additional Info | Areas of interest, spoken languages |

---

## 📦 Download PDF

[![Download PDF](https://img.shields.io/badge/Download-Resume.pdf-blue?logo=adobeacrobatreader)](https://github.com/your-github/resume/raw/main/main.pdf)

---

## 🔗 Connect

| Platform | Link |
|---|---|
| 📧 Email | [your.email@example.com](mailto:your.email@example.com) |
| 💼 LinkedIn | [linkedin.com/in/your-linkedin](https://linkedin.com/in/your-linkedin) |
| 🐙 GitHub | [github.com/your-github](https://github.com/your-github) |

---

*Built with LaTeX · Last updated April 2026*
