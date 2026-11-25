"""
backend/api/preview.py
FastAPI router for live PDF preview generation.
"""
import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException, Response

from backend.core.config import TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER, PROFILE_PHOTO
from backend.services.latex_project import render_project
from starlette.concurrency import run_in_threadpool
from backend.services.resume_service import get_full_config, merge_personal

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

        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            raise HTTPException(401, "Not authenticated")

        main_config = await run_in_threadpool(get_full_config, user_id)

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

        # Merge everything else, but never let a partial personal block wipe
        # the user's real contact details (e.g. their email).
        v_data = {k: v for k, v in config.items() if k != "library"}
        full_config.update(v_data)
        full_config["personal"] = merge_personal(
            main_config.get("personal"), config, v_data
        )

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
                            print("Profile photo download failed")

            photo_to_use = custom_photo_path or (PROFILE_PHOTO if include_photo else None)
            project = await run_in_threadpool(render_project, full_config, template, photo=photo_to_use)
            pdf = await run_in_threadpool(project.pdf)
            return Response(
                content=pdf,
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
        print("Preview generation failed")
        raise HTTPException(500, "Preview generation failed.")
