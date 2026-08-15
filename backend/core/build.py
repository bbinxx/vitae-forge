"""
src/core/build.py
Resume build orchestrator — compiles LaTeX → PDF for one or all roles.
"""
import sys
import json
import shutil
import subprocess
from pathlib import Path

# Add project root to sys.path to allow running the script directly
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from backend.core.config import (
    ROOT, DIST_DIR, LOG_DIR,
    TEMPLATE_PLAIN, TEMPLATE_PHOTO, PROFILE_PHOTO,
    find_pdflatex, load_resume_config,
)
from backend.services.resume_service import get_full_config

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


CACHE_DIR = DIST_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def build_variant(
    source_role: str,
    display_name: str,
    template: Path,
    suffix: str,
    photo: Path | None = None,
    user_id: str = None
) -> bool:
    """
    Generate a single LaTeX variant, compile with pdflatex.
    Returns True on success. Uses in-process generation, batchmode, and MD5 caching.
    """
    import hashlib
    from backend.core.generate import generate_resume

    tex_name = f"{display_name}{suffix}_temp.tex"
    pdf_name = f"{display_name}{suffix}.pdf"

    # In-process generation to eliminate Python process startup overhead
    generate_resume(
        source=source_role,
        template_path=str(template),
        output_path=tex_name,
        photo_path=str(photo) if photo else None,
        user_id=user_id
    )

    tex_file = ROOT / tex_name
    if not tex_file.exists():
        return False

    with open(tex_file, "rb") as tf:
        tex_bytes = tf.read()

    # MD5 Cache Check
    cache_key = hashlib.md5(tex_bytes + str(template).encode() + (str(photo).encode() if photo else b"")).hexdigest()
    cached_pdf = CACHE_DIR / f"{cache_key}.pdf"
    final_pdf_path = DIST_DIR / pdf_name

    if cached_pdf.exists():
        shutil.copy(str(cached_pdf), str(final_pdf_path))
        if tex_file.exists():
            shutil.move(str(tex_file), str(DIST_DIR / f"{display_name}{suffix}.tex"))
        return True

    log_file = LOG_DIR / f"{display_name}{suffix}_build.log"
    pdflatex_cmd = find_pdflatex()
    if not pdflatex_cmd:
        with open(log_file, "w") as lf:
            lf.write("Error: 'pdflatex' executable not found in PATH.\n")
        return False

    # High-speed compilation using batchmode
    subprocess.run(
        [pdflatex_cmd, "-interaction=batchmode", "-halt-on-error",
         f"-output-directory={DIST_DIR}", tex_name],
        cwd=str(ROOT), stdout=open(log_file, "w"), stderr=subprocess.STDOUT,
    )

    temp_pdf = DIST_DIR / f"{display_name}{suffix}_temp.pdf"
    if not temp_pdf.exists():
        # Fallback to nonstopmode if batchmode encountered an error
        subprocess.run(
            [pdflatex_cmd, "-interaction=nonstopmode",
             f"-output-directory={DIST_DIR}", tex_name],
            cwd=str(ROOT), stdout=open(log_file, "w"), stderr=subprocess.STDOUT,
        )

    if temp_pdf.exists():
        shutil.copy(str(temp_pdf), str(cached_pdf))
        shutil.move(str(temp_pdf), str(final_pdf_path))

        if tex_file.exists():
            shutil.move(str(tex_file), str(DIST_DIR / f"{display_name}{suffix}.tex"))

        for ext in (".aux", ".log", ".out"):
            tmp = DIST_DIR / f"{display_name}{suffix}_temp{ext}"
            if tmp.exists():
                tmp.unlink()
        return True
    else:
        try:
            with open(log_file, encoding="utf-8", errors="ignore") as lf:
                lines = lf.readlines()
                tail = "".join(lines[-30:])
            print(f"     Build failed — last log lines:\n{tail}")
        except Exception:
            pass
        return False


def build_role(role_id: str, user_id: str) -> None:
    """Build both plain and photo variants for a single role."""
    config   = get_full_config(user_id)
    name_raw = config.get("personal", {}).get("name", "Resume")
    short    = config.get("recipes", {}).get(role_id, {}).get("short_name", role_id)
    display  = f"{name_raw.upper().replace(' ', '_')}_{short}"

    print("-" * 44)
    print(f"  Building: {display}")
    print("-" * 44)
    build_variant(role_id, display, TEMPLATE_PLAIN, "", user_id=user_id)
    build_variant(role_id, display, TEMPLATE_PHOTO, "_X", PROFILE_PHOTO, user_id=user_id)


def build_custom_version(version_data: dict, display_name: str, include_photo: bool, custom_photo_path: Path | None = None, user_id: str = None) -> bool:
    """
    Build a PDF from an arbitrary configuration dictionary instead of a global recipe.
    Used for application-specific custom versions.
    """
    import tempfile
    
    # Merge with personal/library from main config to ensure complete data
    main_config = get_full_config(user_id) if user_id else load_resume_config()
    full_config = {
        "personal": main_config.get("personal", {}),
        "library": main_config.get("library", {}),
    }
    
    rec_obj = version_data.get("recipe") if (isinstance(version_data, dict) and "recipe" in version_data) else (version_data.get("resume_template") if (isinstance(version_data, dict) and "resume_template" in version_data) else None)
    if isinstance(rec_obj, dict):
        v_data = dict(rec_obj)
        if "cover_letter" not in v_data and "email" in version_data:
            v_data["cover_letter"] = version_data["email"]
        elif "cover_letter" in version_data and "cover_letter" not in v_data:
            v_data["cover_letter"] = version_data["cover_letter"]
    else:
        v_data = dict(version_data)

    if "library" in v_data:
        for lib_type, lib_items in v_data["library"].items():
            if lib_type not in full_config["library"]:
                full_config["library"][lib_type] = {}
            for item_id, item_data in lib_items.items():
                full_config["library"][lib_type][item_id] = item_data
        
        # Don't overwrite the whole library dict in the shallow update
        v_data_clean = dict(v_data)
        del v_data_clean["library"]
        full_config.update(v_data_clean)
    else:
        full_config.update(v_data)
    
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
        
        success = build_variant(tmp_path, display_name, template, suffix, photo_to_use, user_id=user_id)
        
        from backend.core.config import TEMPLATE_COVER_LETTER
        if full_config.get("cover_letter") and str(full_config.get("cover_letter")).strip():
            print(f"  Building Cover Letter: {display_name}_Cover_Letter")
            build_variant(tmp_path, display_name, TEMPLATE_COVER_LETTER, "_Cover_Letter", None, user_id=user_id)
            
        return success
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def build_all(user_id: str) -> None:
    """Build every role defined in the resume config."""
    config = get_full_config(user_id)
    roles = list(config.get("recipes", {}).keys())
    
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=8) as executor:
        # Pass user_id to build_role
        executor.map(lambda r: build_role(r, user_id), roles)
        
    print("=" * 44)
    print(" All builds complete.")
    print("=" * 44)


def generate_latex_source(version_data: dict, display_name: str, include_photo: bool, user_id: str = None) -> str | None:
    """
    Generate LaTeX source from arbitrary configuration data WITHOUT compiling to PDF.
    Returns the LaTeX source string, or None on failure.
    """
    import tempfile

    main_config = get_full_config(user_id) if user_id else load_resume_config()
    full_config = {
        "personal": main_config.get("personal", {}),
        "library": main_config.get("library", {}),
    }

    rec_obj = version_data.get("recipe") if (isinstance(version_data, dict) and "recipe" in version_data) else (version_data.get("resume_template") if (isinstance(version_data, dict) and "resume_template" in version_data) else None)
    if isinstance(rec_obj, dict):
        v_data = dict(rec_obj)
        if "cover_letter" not in v_data and "email" in version_data:
            v_data["cover_letter"] = version_data["email"]
        elif "cover_letter" in version_data and "cover_letter" not in v_data:
            v_data["cover_letter"] = version_data["cover_letter"]
    else:
        v_data = dict(version_data)

    if "library" in v_data:
        for lib_type, lib_items in v_data["library"].items():
            if lib_type not in full_config["library"]:
                full_config["library"][lib_type] = {}
            for item_id, item_data in lib_items.items():
                full_config["library"][lib_type][item_id] = item_data
        v_data_clean = dict(v_data)
        del v_data_clean["library"]
        full_config.update(v_data_clean)
    else:
        full_config.update(v_data)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(full_config, tmp)
        tmp_path = tmp.name

    try:
        generate_py = ROOT / "src" / "core" / "generate.py"
        template = TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN
        suffix = "_X" if include_photo else ""
        tex_name = f"{display_name}{suffix}_temp.tex"
        photo = PROFILE_PHOTO if include_photo else None

        gen_cmd = [sys.executable, str(generate_py), tmp_path, str(template), tex_name]
        if photo:
            gen_cmd += ["--photo", str(photo)]
        if user_id:
            gen_cmd += ["--user", user_id]
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
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("role", nargs="?", default="all")
    parser.add_argument("--user", required=False, help="User ID")
    args = parser.parse_args()
    
    if args.role == "clean":
        clean()
    elif args.role == "all":
        build_all(args.user)
    else:
        build_role(args.role, args.user)
