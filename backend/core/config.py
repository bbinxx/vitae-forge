"""
src/core/config.py
Single source of truth for all project paths and config I/O helpers.
"""
from pathlib import Path
import json

# ── Root Paths ────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.parent.parent
CONFIGS_DIR = ROOT / "configs"
DIST_DIR    = Path("/tmp/resume_dist")
LOG_DIR     = Path("/tmp/resume_logs")
ASSETS_DIR  = ROOT / "assets"
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
TEX_DIR     = TEMPLATES_DIR / "tex"
PROFILE_PHOTO = ASSETS_DIR / "profile-photo.jpg"
ENV_FILE    = ROOT / ".env"

DEFAULT_STARTER_CONFIG = {
  "personal": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "phone": "+1 (555) 000-0000",
    "linkedin": "your-linkedin",
    "github": "your-github"
  },
  "role_title": "Your Role Title",
  "summary": "Brief professional summary describing your experience, key skills, and career goals. Update this with your own background.",
  "alternative_summaries": {},
  "skills": {
    "Languages": [],
    "Frameworks": [],
    "Developer Tools": [],
    "Databases": [],
    "Deployment": []
  },
  "experience": [],
  "projects": [],
  "education": {
    "degree": "Your Degree",
    "institution": "Your Institution",
    "year": "Year"
  },
  "certifications": [],
  "achievements": [],
  "additional_info": {
    "areas_of_interest": "",
    "languages": ""
  },
  "cover_letter": "Dear Hiring Manager,\n\nI am excited to apply for the [Role] position at [Company]. [Introduce yourself and summarize your background.]\n\n[Describe your key experience and what you bring to this role.]\n\nThank you for your time and consideration. I look forward to discussing how my skills and experience can contribute to your organization.\n\nSincerely,\nYour Name",
  "layout": {
    "one_page": True,
    "ats_optimized": True,
    "photo": False
  },
  "sections": {
    "role_title": True,
    "photo": False,
    "summary": True,
    "skills": True,
    "experience": True,
    "projects": True,
    "education": True,
    "certifications": True,
    "achievements": True,
    "languages": True,
    "areas_of_interest": False
  },
  "section_order": [
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
    "achievements",
    "additional_info"
  ],
  "section_titles": {
    "summary": "Professional Summary",
    "skills": "Skills",
    "experience": "Experience",
    "projects": "Projects",
    "education": "Education",
    "certifications": "Certifications",
    "achievements": "Achievements",
    "additional_info": "Additional Information"
  },
  "styling": {
    "font_size": "10pt",
    "margin_top": "0.3in",
    "margin_bottom": "0.3in",
    "margin_left": "0.45in",
    "margin_right": "0.45in",
    "primary_color_hex": "000000",
    "rule_thickness": "0.5pt"
  }
}

import copy

def load_resume_config() -> dict:
    """Return default starter resume configuration (in-memory)."""
    return copy.deepcopy(DEFAULT_STARTER_CONFIG)

# ── LaTeX Templates ───────────────────────────────────────────────────────────
TEMPLATE_PLAIN = TEX_DIR / "template.tex"
TEMPLATE_PHOTO = TEX_DIR / "template_photo.tex"
TEMPLATE_COVER_LETTER = TEX_DIR / "cover_letter.tex"

def ensure_dirs() -> None:
    """Make sure all required output directories exist."""
    for d in (DIST_DIR, LOG_DIR, ASSETS_DIR):
        d.mkdir(parents=True, exist_ok=True)


# ── LaTeX Compiler Discovery ──────────────────────────────────────────────────

def find_pdflatex() -> str | None:
    """Locate the pdflatex executable (system PATH or TinyTeX fallback)."""
    import shutil, glob, os
    cmd = shutil.which("pdflatex")
    if cmd:
        return cmd
    tinytex = glob.glob(os.path.expanduser("~/.TinyTeX/bin/*/pdflatex"))
    return tinytex[0] if tinytex else None
