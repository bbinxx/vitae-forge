"""
src/core/build.py
Resume build orchestrator — compiles LaTeX → PDF for one or all roles.
"""
import sys
import json
import shutil
import subprocess
import re
from pathlib import Path

# Add project root to sys.path to allow running the script directly
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.core.config import (
    ROOT, RESUME_CONFIG, DIST_DIR, LOG_DIR,
    TEMPLATE_PLAIN, TEMPLATE_PHOTO, PROFILE_PHOTO,
)

# Ensure output dirs exist on import
DIST_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)


def clean() -> None:
    """Remove all build artefacts (dist PDFs/TEX/AUX, logs)."""
    print(" Cleaning build artefacts...")
    if LOG_DIR.exists():
        shutil.rmtree(LOG_DIR)
    LOG_DIR.mkdir(exist_ok=True)

    if DIST_DIR.exists():
        for f in DIST_DIR.glob("*"):
            if f.suffix in {".aux", ".log", ".out", ".pdf", ".tex"}:
                f.unlink()

    for f in ROOT.glob("*_temp.tex"):
        f.unlink()

    print(" Clean complete.")


def build_variant(
    source_role: str,
    display_name: str,
    template: Path,
    suffix: str,
    photo: Path | None = None,
) -> bool:
    """
    Generate a single LaTeX variant, compile with pdflatex.
    Returns True on success.
    """
    generate_py = ROOT / "src" / "core" / "generate.py"
    tex_name   = f"{display_name}{suffix}_temp.tex"
    pdf_name   = f"{display_name}{suffix}.pdf"
    print(f"  → Variant: {suffix or 'Standard'}")

    gen_cmd = [sys.executable, str(generate_py), source_role, str(template), tex_name]
    if photo:
        gen_cmd += ["--photo", str(photo)]
    subprocess.run(gen_cmd, cwd=str(ROOT), check=True)

    log_file = LOG_DIR / f"{display_name}{suffix}_build.log"
    print("  → Compiling with pdflatex...")
    with open(log_file, "w") as lf:
        res = subprocess.run(
            ["pdflatex", "-interaction=nonstopmode",
             f"-output-directory={DIST_DIR}", tex_name],
            cwd=str(ROOT), stdout=lf, stderr=lf,
        )

    if res.returncode == 0:
        pages = "?"
        with open(log_file, encoding="utf-8", errors="ignore") as lf:
            m = re.search(r"Output written on.*?\(([0-9]+) page", lf.read())
            if m:
                pages = m.group(1)
        print(f"     {pdf_name} ({pages} page(s))")

        # Rename temp → final
        temp_pdf = DIST_DIR / f"{display_name}{suffix}_temp.pdf"
        if temp_pdf.exists():
            temp_pdf.rename(DIST_DIR / pdf_name)

        tex_src = ROOT / tex_name
        if tex_src.exists():
            tex_src.rename(DIST_DIR / f"{display_name}{suffix}.tex")

        for ext in (".aux", ".log", ".out"):
            tmp = DIST_DIR / f"{display_name}{suffix}_temp{ext}"
            if tmp.exists():
                tmp.unlink()
        return True
    else:
        print(f"     Build failed — check {log_file}")
        return False


def build_role(role_id: str) -> None:
    """Build both plain and photo variants for a single role."""
    config   = json.loads(RESUME_CONFIG.read_text())
    name_raw = config.get("personal", {}).get("name", "Resume")
    short    = config.get("recipes", {}).get(role_id, {}).get("short_name", role_id)
    display  = f"{name_raw.upper().replace(' ', '_')}_{short}"

    print("-" * 44)
    print(f"  Building: {display}")
    print("-" * 44)
    build_variant(role_id, display, TEMPLATE_PLAIN, "")
    build_variant(role_id, display, TEMPLATE_PHOTO, "_X", PROFILE_PHOTO)


def build_all() -> None:
    """Build every role defined in the resume config."""
    config = json.loads(RESUME_CONFIG.read_text())
    roles = list(config.get("recipes", {}).keys())
    
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=8) as executor:
        executor.map(build_role, roles)
        
    print("=" * 44)
    print(" All builds complete.")
    print("=" * 44)


if __name__ == "__main__":
    import sys as _sys
    if len(_sys.argv) > 1:
        arg = _sys.argv[1]
        if arg == "clean":
            clean()
        else:
            build_role(arg)
    else:
        build_all()
