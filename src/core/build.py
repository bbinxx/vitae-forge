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
    load_resume_config, find_pdflatex,
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
    
    pdflatex_cmd = find_pdflatex()
    if not pdflatex_cmd:
        print("     Error: 'pdflatex' executable not found in PATH.")
        with open(log_file, "w") as lf:
            lf.write("Error: 'pdflatex' executable not found in PATH.\n")
            lf.write("Please install a LaTeX distribution (like TeX Live or MiKTeX) to compile PDFs.\n")
        return False

    subprocess.run(
        [pdflatex_cmd, "-interaction=nonstopmode",
         f"-output-directory={DIST_DIR}", tex_name],
        cwd=str(ROOT), stdout=open(log_file, "w"), stderr=subprocess.STDOUT,
    )

    # Check if the PDF was actually produced (pdflatex may exit non-zero on warnings)
    temp_pdf = DIST_DIR / f"{display_name}{suffix}_temp.pdf"
    if temp_pdf.exists():
        pages = "?"
        with open(log_file, encoding="utf-8", errors="ignore") as lf:
            m = re.search(r"Output written on.*?\(([0-9]+) page", lf.read())
            if m:
                pages = m.group(1)
        print(f"     {pdf_name} ({pages} page(s))")

        # Rename temp → final
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
        # Read last 30 lines of log for diagnostics
        try:
            with open(log_file, encoding="utf-8", errors="ignore") as lf:
                lines = lf.readlines()
                tail = "".join(lines[-30:])
            print(f"     Build failed — last log lines:\n{tail}")
        except Exception:
            pass
        return False


def build_role(role_id: str) -> None:
    """Build both plain and photo variants for a single role."""
    config   = load_resume_config()
    name_raw = config.get("personal", {}).get("name", "Resume")
    short    = config.get("recipes", {}).get(role_id, {}).get("short_name", role_id)
    display  = f"{name_raw.upper().replace(' ', '_')}_{short}"

    print("-" * 44)
    print(f"  Building: {display}")
    print("-" * 44)
    build_variant(role_id, display, TEMPLATE_PLAIN, "")
    build_variant(role_id, display, TEMPLATE_PHOTO, "_X", PROFILE_PHOTO)


def build_custom_version(version_data: dict, display_name: str, include_photo: bool, custom_photo_path: Path | None = None) -> bool:
    """
    Build a PDF from an arbitrary configuration dictionary instead of a global recipe.
    Used for application-specific custom versions.
    """
    import tempfile
    
    # Merge with personal/library from main config to ensure complete data
    main_config = load_resume_config()
    full_config = {
        "personal": main_config.get("personal", {}),
        "library": main_config.get("library", {}),
    }
    
    # Recursively merge library so we don't lose un-customized items
    if "library" in version_data:
        for lib_type, lib_items in version_data["library"].items():
            if lib_type not in full_config["library"]:
                full_config["library"][lib_type] = {}
            for item_id, item_data in lib_items.items():
                full_config["library"][lib_type][item_id] = item_data
        
        # Don't overwrite the whole library dict in the shallow update
        v_data = dict(version_data)
        del v_data["library"]
        full_config.update(v_data)
    else:
        full_config.update(version_data)
    
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(full_config, tmp)
        tmp_path = tmp.name
        
    try:
        print("-" * 44)
        print(f"  Building Custom Version: {display_name}")
        print("-" * 44)
        
        template = TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN
        suffix = "_X" if include_photo else ""
        photo_to_use = custom_photo_path if (include_photo and custom_photo_path) else (PROFILE_PHOTO if include_photo else None)
        
        success = build_variant(tmp_path, display_name, template, suffix, photo_to_use)
        
        from src.core.config import TEMPLATE_COVER_LETTER
        if full_config.get("cover_letter") and str(full_config.get("cover_letter")).strip():
            print(f"  Building Cover Letter: {display_name}_Cover_Letter")
            build_variant(tmp_path, display_name, TEMPLATE_COVER_LETTER, "_Cover_Letter", None)
            
        return success
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def build_all() -> None:
    """Build every role defined in the resume config."""
    config = load_resume_config()
    roles = list(config.get("recipes", {}).keys())
    
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=8) as executor:
        executor.map(build_role, roles)
        
    print("=" * 44)
    print(" All builds complete.")
    print("=" * 44)


def generate_latex_source(version_data: dict, display_name: str, include_photo: bool) -> str | None:
    """
    Generate LaTeX source from arbitrary configuration data WITHOUT compiling to PDF.
    Returns the LaTeX source string, or None on failure.
    """
    import tempfile

    main_config = load_resume_config()
    full_config = {
        "personal": main_config.get("personal", {}),
        "library": main_config.get("library", {}),
    }

    if "library" in version_data:
        for lib_type, lib_items in version_data["library"].items():
            if lib_type not in full_config["library"]:
                full_config["library"][lib_type] = {}
            for item_id, item_data in lib_items.items():
                full_config["library"][lib_type][item_id] = item_data
        v_data = dict(version_data)
        del v_data["library"]
        full_config.update(v_data)
    else:
        full_config.update(version_data)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(full_config, tmp)
        tmp_path = tmp.name

    try:
        generate_py = ROOT / "src" / "core" / "generate.py"
        template = TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN
        suffix = "_X" if include_photo else ""
        tex_name = f"{display_name}{suffix}_temp.tex"
        gen_cmd = [sys.executable, str(generate_py), tmp_path, str(template), tex_name]
        # Don't pass --photo; leave <<PHOTO_PATH>> placeholder in output
        # so callers (ZIP/LaTeX download) can substitute their own path
        subprocess.run(gen_cmd, cwd=str(ROOT), check=True)

        tex_src = ROOT / tex_name
        if tex_src.exists():
            content = tex_src.read_text()
            tex_src.unlink()
            return content
        return None
    except Exception as e:
        print(f"generate_latex_source error: {e}")
        return None
    finally:
        Path(tmp_path).unlink(missing_ok=True)


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
