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

DEFAULT_STARTER_CONFIG = {
  "personal": {
    "name": "YOUR NAME",
    "email": "your.email@example.com",
    "phone": "+1 (555) 000-0000",
    "linkedin": "your-linkedin",
    "github": "your-github"
  },
  "library": {
    "professional_summary": {
      "sd": "Software Engineer with practical experience in full-stack development, server-side systems, and scalable solution design."
    },
    "role_title": {
      "sd": "Software Engineer"
    },
    "skills": {
      "lang_all": {
        "name": "Languages",
        "keywords": "Python, JavaScript, TypeScript, HTML, CSS"
      }
    },
    "experience": {},
    "projects": {},
    "education": {},
    "certifications": {},
    "achievements": {},
    "additional_info": {}
  },
  "recipes": {
    "standard": {
      "short_name": "SD",
      "sections": {
        "role_title": True,
        "summary": True,
        "skills": True
      },
      "role_title": "sd",
      "professional_summary": "sd",
      "skills": ["lang_all"]
    }
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
