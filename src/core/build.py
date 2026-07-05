"""
src/core/build.py
Resume build orchestrator — compiles LaTeX → PDF for one or all roles.
"""
import sys
import json
import shutil
import subprocess
import re
import tempfile
from pathlib import Path

# Add project root to sys.path to allow running the script directly
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.core.config import (
    ROOT, DIST_DIR, LOG_DIR,
    TEMPLATE_PLAIN, TEMPLATE_PHOTO, PROFILE_PHOTO,
    find_pdflatex,
)
from src.services.resume_service import get_full_config

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


_PDFLATEX_CACHE = None

def _get_pdflatex():
    global _PDFLATEX_CACHE
    if _PDFLATEX_CACHE is None:
        _PDFLATEX_CACHE = find_pdflatex()
    return _PDFLATEX_CACHE


def build_variant(
    source_role: str,
    display_name: str,
    template: Path,
    suffix: str,
    photo: Path | None = None,
    user_id: str = None,
) -> tuple[bool, bytes | None]:
    """
    Generate a single LaTeX variant and compile with pdflatex.
    Returns (success, pdf_bytes). No files are left on disk.
    """
    from src.core.generate import generate_resume

    pdf_name = f"{display_name}{suffix}.pdf"
    log_file = LOG_DIR / f"{display_name}{suffix}_build.log"
    print(f"  → Variant: {suffix or 'Standard'}")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        tex_name = f"{display_name}{suffix}.tex"
        tmp_tex = tmp / tex_name
        tmp_pdf = tmp / pdf_name

        generate_resume(
            source_role, str(template), str(tmp_tex),
            photo_path=str(photo) if photo else None,
            user_id=user_id,
        )

        pdflatex_cmd = _get_pdflatex()
        if not pdflatex_cmd:
            print("     Error: 'pdflatex' executable not found in PATH.")
            with open(log_file, "w") as lf:
                lf.write("Error: 'pdflatex' executable not found in PATH.\n")
                lf.write("Please install a LaTeX distribution (like TeX Live or MiKTeX) to compile PDFs.\n")
            return False, None

        print("  → Compiling with pdflatex...")
        with open(log_file, "w") as lf:
            subprocess.run(
                [pdflatex_cmd, "-interaction=nonstopmode",
                 f"-output-directory={tmp}", tex_name],
                cwd=str(tmp), stdout=lf, stderr=subprocess.STDOUT,
                timeout=60,
            )

        if tmp_pdf.exists():
            pages = "?"
            with open(log_file, encoding="utf-8", errors="ignore") as lf:
                m = re.search(r"Output written on.*?\(([0-9]+) page", lf.read())
                if m:
                    pages = m.group(1)
            print(f"     {pdf_name} ({pages} page(s))")
            return True, tmp_pdf.read_bytes()

        try:
            with open(log_file, encoding="utf-8", errors="ignore") as lf:
                lines = lf.readlines()
                tail = "".join(lines[-30:])
            print(f"     Build failed — last log lines:\n{tail}")
        except Exception:
            pass
        return False, None


def build_role(role_id: str, user_id: str) -> None:
    """Build both plain and photo variants for a single role."""
    if not PROFILE_PHOTO.exists():
        try:
            from src.core.upload import get_r2_client, BUCKET
            client = get_r2_client()
            if client:
                import io
                buf = io.BytesIO()
                client.download_fileobj(BUCKET, "profile-photo.jpg", buf)
                PROFILE_PHOTO.parent.mkdir(parents=True, exist_ok=True)
                PROFILE_PHOTO.write_bytes(buf.getvalue())
        except Exception:
            pass

    config   = get_full_config(user_id)
    name_raw = config.get("personal", {}).get("name", "Resume")
    short    = config.get("recipes", {}).get(role_id, {}).get("short_name", role_id)
    display  = f"{name_raw.upper().replace(' ', '_')}_{short}"

    print("-" * 44)
    print(f"  Building: {display}")
    print("-" * 44)

    for suffix, tpl, photo_arg in [
        ("",       TEMPLATE_PLAIN,  None),
        ("_X",     TEMPLATE_PHOTO,  PROFILE_PHOTO),
    ]:
        success, pdf_bytes = build_variant(
            role_id, display, tpl, suffix,
            photo=photo_arg, user_id=user_id,
        )
        if success and pdf_bytes:
            (DIST_DIR / f"{display}{suffix}.pdf").write_bytes(pdf_bytes)


def build_custom_version(
    version_data: dict,
    display_name: str,
    include_photo: bool,
    custom_photo_path: Path | None = None,
    user_id: str = None,
) -> bytes | None:
    """
    Build a PDF from an arbitrary configuration dictionary.
    Returns PDF bytes, or None on failure. No files are left on disk.
    """
    if include_photo and not custom_photo_path and not PROFILE_PHOTO.exists():
        try:
            from src.core.upload import get_r2_client, BUCKET
            client = get_r2_client()
            if client:
                import io
                buf = io.BytesIO()
                client.download_fileobj(BUCKET, "profile-photo.jpg", buf)
                PROFILE_PHOTO.parent.mkdir(parents=True, exist_ok=True)
                PROFILE_PHOTO.write_bytes(buf.getvalue())
        except Exception:
            pass

    main_config = get_full_config(user_id) if user_id else {}
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
        print("-" * 44)
        print(f"  Building Custom Version: {display_name}")
        print("-" * 44)

        template = TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN
        suffix = "_X" if include_photo else ""
        photo_to_use = custom_photo_path if (include_photo and custom_photo_path) else (PROFILE_PHOTO if include_photo else None)

        pdf_bytes = build_variant(
            tmp_path, display_name, template, suffix,
            photo=photo_to_use, user_id=user_id,
        )[1]  # (success, bytes) -> bytes

        return pdf_bytes
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def build_all(user_id: str) -> None:
    """Build every role defined in the resume config."""
    config = get_full_config(user_id)
    roles = list(config.get("recipes", {}).keys())

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=3) as executor:
        executor.map(lambda r: build_role(r, user_id), roles)

    print("=" * 44)
    print(" All builds complete.")
    print("=" * 44)


def generate_latex_source(version_data: dict, display_name: str, include_photo: bool, user_id: str = None) -> str | None:
    """
    Generate LaTeX source from arbitrary configuration data WITHOUT compiling to PDF.
    Returns the LaTeX source string, or None on failure. No files are left on disk.
    """
    from src.core.generate import generate_resume

    main_config = get_full_config(user_id) if user_id else {"personal": {}, "library": {}, "recipes": {}}
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
        template = TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN
        suffix = "_X" if include_photo else ""

        if include_photo and not PROFILE_PHOTO.exists():
            try:
                from src.core.upload import get_r2_client, BUCKET
                client = get_r2_client()
                if client:
                    import io
                    buf = io.BytesIO()
                    client.download_fileobj(BUCKET, "profile-photo.jpg", buf)
                    PROFILE_PHOTO.parent.mkdir(parents=True, exist_ok=True)
                    PROFILE_PHOTO.write_bytes(buf.getvalue())
            except Exception:
                pass

        photo_path = str(PROFILE_PHOTO) if include_photo and PROFILE_PHOTO.exists() else None

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)
            tex_name = f"{display_name}{suffix}.tex"
            tex_path = tmp / tex_name

            generate_resume(tmp_path, str(template), str(tex_path), photo_path=photo_path, user_id=user_id)

            if tex_path.exists():
                return tex_path.read_text()
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
