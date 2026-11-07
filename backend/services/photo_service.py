"""
backend/services/photo_service.py
Centralised helper for downloading a user's profile photo from R2.

Previously this 20-line block was copy-pasted three times across tracker.py
(create_application, update_application, compile_pdf). Now it lives in one place.
"""
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import HTTPException


def resolve_photo_path(user_id: str, include_photo: bool) -> Optional[Path]:
    """
    If *include_photo* is True, download the user's photo from R2 and return
    the path to a temporary file that the caller owns (must delete after use).

    Returns None if include_photo is False, R2 is not configured, or the user
    has no photo set in their settings.

    The caller is responsible for cleaning up the returned temp file:

        photo_path = resolve_photo_path(user_id, include_photo)
        try:
            build_pdf(..., custom_photo_path=photo_path)
        finally:
            if photo_path:
                photo_path.unlink(missing_ok=True)
    """
    if not include_photo:
        return None

    try:
        from backend.db import db
        settings = db.get_settings(user_id) or {}
    except Exception:
        return None

    photo_r2_key: str = settings.get("photo_r2_key", "")
    if not photo_r2_key:
        return None

    try:
        from backend.core.upload import get_r2_client, BUCKET
        client = get_r2_client()
        if not client:
            return None

        suffix = Path(photo_r2_key).suffix or ".jpg"
        tmp = tempfile.NamedTemporaryFile("wb", delete=False, suffix=suffix)
        try:
            client.download_fileobj(BUCKET, photo_r2_key, tmp)
        finally:
            tmp.close()
        return Path(tmp.name)

    except Exception as exc:
        print(f"[photo_service] Could not download photo for user {user_id}: {exc}")
        return None
