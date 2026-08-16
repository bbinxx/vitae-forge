"""
backend/api/preview.py
FastAPI router for live PDF preview generation.
"""
import json
import tempfile
import subprocess
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException, Response
from jose import jwt, JWTError

from backend.core.config import TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER, PROFILE_PHOTO, find_pdflatex
from backend.core.generate import generate_resume
from backend.api.auth import SECRET_KEY, ALGORITHM
from backend.services.resume_service import get_full_config

router = APIRouter(prefix="/api", tags=["preview"])

@router.post("/preview-pdf")
async def preview_pdf(request: Request):
    """Generate a temporary preview PDF from a JSON config (no file save)."""
    try:
        body = await request.json()
        config = body.get("config", {})
        pdf_name = body.get("pdf_name", "preview.pdf")
        preview_type = body.get("type", "resume")
        include_photo = body.get("include_photo", False)

        if not config:
            raise HTTPException(400, "Missing 'config' in request body")

        # Need user_id for preview, try to get from request state or Authorization header
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                try:
                    payload = jwt.decode(auth_header.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
                    user_id = payload.get("sub")
                except JWTError:
                    pass

        if not user_id:
            raise HTTPException(401, "Not authenticated")

        main_config = get_full_config(user_id)

        full_config = {
            "personal": main_config.get("personal", {}),
            "library": main_config.get("library", {}),
        }

        # Recursively merge library from custom config
        if "library" in config:
            for lib_type, lib_items in config.get("library", {}).items():
                if lib_type not in full_config["library"]:
                    full_config["library"][lib_type] = {}
                full_config["library"][lib_type].update(lib_items)

        # Merge everything else
        v_data = {k: v for k, v in config.items() if k != "library"}
        full_config.update(v_data)

        # Force sections['photo'] to match include_photo so the LaTeX generator renders it
        if "sections" not in full_config:
            full_config["sections"] = {}
        full_config["sections"]["photo"] = include_photo

        if preview_type == "cover_letter":
            template = TEMPLATE_COVER_LETTER
        elif include_photo:
            template = TEMPLATE_PHOTO
        else:
            template = TEMPLATE_PLAIN

        pdflatex_cmd = find_pdflatex()
        if not pdflatex_cmd:
            raise HTTPException(
                status_code=400,
                detail="LaTeX compiler 'pdflatex' not found on system. Please install TeX Live or compile downloaded TeX bundle in Overleaf."
            )

        custom_photo_path = None
        try:
            if include_photo and user_id:
                from backend.db import db
                settings = db.get_settings(user_id) or {}
                photo_r2_key = settings.get("photo_r2_key")
                if photo_r2_key:
                    from backend.core.upload import get_r2_client, BUCKET
                    client = get_r2_client()
                    if client:
                        try:
                            suffix = Path(photo_r2_key).suffix
                            with tempfile.NamedTemporaryFile("wb", delete=False, suffix=suffix) as tmp_photo:
                                client.download_fileobj(BUCKET, photo_r2_key, tmp_photo)
                                custom_photo_path = Path(tmp_photo.name)
                        except Exception as e:
                            print(f"Error downloading settings photo: {e}")

            # All temp artefacts live in one directory so cleanup is complete.
            with tempfile.TemporaryDirectory(prefix="resume_preview_") as tmp_dir:
                tmp_dir_path = Path(tmp_dir)
                tmp_config_path = tmp_dir_path / "config.json"
                tmp_tex_path = tmp_dir_path / "resume.tex"

                with open(tmp_config_path, "w") as f:
                    json.dump(full_config, f)

                photo_to_use = str(custom_photo_path) if custom_photo_path else (str(PROFILE_PHOTO) if include_photo else None)
                generate_resume(
                    str(tmp_config_path), str(template), str(tmp_tex_path),
                    photo_path=photo_to_use,
                )

                proc = subprocess.run(
                    [pdflatex_cmd, "-interaction=nonstopmode", "-output-directory", tmp_dir, str(tmp_tex_path)],
                    capture_output=True, timeout=30,
                )

                pdf_file = tmp_tex_path.with_suffix(".pdf")
                if not pdf_file.exists():
                    detail = "PDF compilation failed."
                    log = (tmp_tex_path.with_suffix(".log").read_text(errors="ignore") if tmp_tex_path.with_suffix(".log").exists() else "")
                    if proc.returncode != 0 and log:
                        tail = "\n".join(l for l in log.splitlines()[-15:] if "error" in l.lower() or "!" in l)
                        detail = f"{detail} {tail}"
                    raise HTTPException(500, detail)

                return Response(
                    content=pdf_file.read_bytes(),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{pdf_name}"'},
                )
        finally:
            if custom_photo_path:
                custom_photo_path.unlink(missing_ok=True)

    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in request body")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Preview error: {e}")
        raise HTTPException(500, f"Preview generation failed: {str(e)}")
