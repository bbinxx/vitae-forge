"""
backend/core/config.py
Single source of truth for all project paths and config I/O helpers.
"""
import copy
import json
from pathlib import Path

# ── Root Paths ────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).parent.parent.parent
DIST_DIR      = Path("/tmp/resume_dist")
LOG_DIR       = Path("/tmp/resume_logs")
ASSETS_DIR    = ROOT / "assets"
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
TEX_DIR       = TEMPLATES_DIR / "tex"
PROFILE_PHOTO = ASSETS_DIR / "profile-photo.jpg"
ENV_FILE      = ROOT / ".env"

# ── Default Resume Config ─────────────────────────────────────────────────────
_DEFAULTS_FILE = Path(__file__).parent / "defaults" / "starter_config.json"

def _load_defaults() -> dict:
    """Load the default starter config from the bundled JSON file."""
    if _DEFAULTS_FILE.exists():
        with open(_DEFAULTS_FILE, encoding="utf-8") as f:
            return json.load(f)
    # Inline fallback if file is missing (e.g. during tests)
    return {
        "personal": {
            "name": "Your Name",
            "email": "your.email@example.com",
            "phone": "+1 (555) 000-0000",
            "linkedin": "your-linkedin",
            "github": "your-github",
        },
        "role_title": "Your Role Title",
        "summary": "Brief professional summary.",
        "alternative_summaries": {},
        "skills": {
            "Languages": [],
            "Frameworks": [],
            "Developer Tools": [],
            "Databases": [],
            "Deployment": [],
        },
        "experience": [],
        "projects": [],
        "education": {"degree": "Your Degree", "institution": "Your Institution", "year": "Year"},
        "certifications": [],
        "achievements": [],
        "additional_info": {"areas_of_interest": "", "languages": ""},
        "cover_letter": (
            "Dear Hiring Manager,\n\nI am excited to apply for the [Role] position at [Company].\n\n"
            "Thank you for your time and consideration.\n\nSincerely,\nYour Name"
        ),
        "layout": {"one_page": True, "ats_optimized": True, "photo": False},
        "sections": {
            "role_title": True, "photo": False, "summary": True,
            "skills": True, "experience": True, "projects": True,
            "education": True, "certifications": True, "achievements": True,
            "languages": True, "areas_of_interest": False,
        },
        "section_order": [
            "summary", "skills", "experience", "projects",
            "education", "certifications", "achievements", "additional_info",
        ],
        "section_titles": {
            "summary": "Professional Summary", "skills": "Skills",
            "experience": "Experience", "projects": "Projects",
            "education": "Education", "certifications": "Certifications",
            "achievements": "Achievements", "additional_info": "Additional Information",
        },
        "styling": {
            "font_size": "10pt", "margin_top": "0.3in", "margin_bottom": "0.3in",
            "margin_left": "0.45in", "margin_right": "0.45in",
            "primary_color_hex": "000000", "rule_thickness": "0.5pt",
        },
    }


# Cached at module load — immutable reference; callers get deep copies
_DEFAULT_STARTER_CONFIG: dict = _load_defaults()


def load_resume_config() -> dict:
    """Return a deep copy of the default starter resume configuration."""
    return copy.deepcopy(_DEFAULT_STARTER_CONFIG)


# ── LaTeX Templates ───────────────────────────────────────────────────────────
TEMPLATE_PLAIN        = TEX_DIR / "template.tex"
TEMPLATE_PHOTO        = TEX_DIR / "template_photo.tex"
TEMPLATE_COVER_LETTER = TEX_DIR / "cover_letter.tex"


def ensure_dirs() -> None:
    """Ensure all required output directories exist."""
    for d in (DIST_DIR, LOG_DIR, ASSETS_DIR):
        d.mkdir(parents=True, exist_ok=True)


# ── LaTeX Compiler Discovery ──────────────────────────────────────────────────

def find_pdflatex() -> str | None:
    """Locate the pdflatex executable (system PATH or TinyTeX fallback)."""
    import shutil
    import glob
    import os
    cmd = shutil.which("pdflatex")
    if cmd:
        return cmd
    tinytex = glob.glob(os.path.expanduser("~/.TinyTeX/bin/*/pdflatex"))
    return tinytex[0] if tinytex else None
