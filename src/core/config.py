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
TEMPLATES_DIR = ROOT / "templates"
TEX_DIR     = TEMPLATES_DIR / "tex"
STATIC_DIR  = ROOT / "static"

# ── Well-known Files ──────────────────────────────────────────────────────────
RESUME_CONFIG    = CONFIGS_DIR / "resume_config.template.json"
ENV_FILE         = ROOT / ".env"
PROFILE_PHOTO    = ASSETS_DIR / "profile-photo.jpg"

# ── LaTeX Templates ───────────────────────────────────────────────────────────
TEMPLATE_PLAIN = TEX_DIR / "template.tex"
TEMPLATE_PHOTO = TEX_DIR / "template_photo.tex"
TEMPLATE_COVER_LETTER = TEX_DIR / "cover_letter.tex"



def ensure_dirs() -> None:
    """Make sure all required output directories exist."""
    for d in (DIST_DIR, LOG_DIR, STATIC_DIR, CONFIGS_DIR, ASSETS_DIR):
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
