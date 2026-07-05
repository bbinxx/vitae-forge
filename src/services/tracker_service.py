import uuid
import re
from datetime import datetime
from typing import Dict, Any, List

from src.db import db

def sanitize_filename(value: str, fallback: str = "app") -> str:
    if not value or not isinstance(value, str):
        return fallback
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip().replace(' ', '_'))
    cleaned = re.sub(r"_+", "_", cleaned).strip('_')
    return cleaned or fallback

def build_display_name(user_id: str, app: dict) -> str:
    settings = db.get_settings(user_id)
    prefix = settings.get('file_name_prefix', 'RESUME-') if isinstance(settings, dict) else 'RESUME-'
    if not app:
        return f"{prefix}app"
    role = app.get('role', '')
    if role:
        name = role.strip('_')
        return f"{prefix}{sanitize_filename(name, fallback='app')}"
    return f"{prefix}{sanitize_filename(app.get('id', ''), fallback='app')}"

def timeline_event(status: str, note: str = "") -> dict:
    return {
        "status": status,
        "date": datetime.now().isoformat(),
        "note": note,
    }

def default_app(app_id: str, body: dict) -> dict:
    status = body.get("status", "Bookmarked")
    return {
        "id":               app_id,
        "company":          body.get("company", ""),
        "role":             body.get("role", ""),
        "location":         body.get("location", ""),
        "job_url":          body.get("job_url", ""),
        "status":           status,
        "priority":         body.get("priority", "Medium"),
        "job_type":         body.get("job_type", ""),
        "source":           body.get("source", ""),
        "platform":         body.get("platform", ""),
        "tags":             body.get("tags", []),
        "assigned_resume":      body.get("assigned_resume", ""),
        "assigned_version_id":  body.get("assigned_version_id", ""),
        "archived_pdf":         body.get("archived_pdf", ""), # R2 key or URL
        "resume_template":      body.get("resume_template", {}),  # Per-app JSON resume template
        "notes":            body.get("notes", ""),
        "job_description":  body.get("job_description", ""),
        "deadline":         body.get("deadline", ""),
        "salary_range":     body.get("salary_range", ""),
        "contact_name":     body.get("contact_name", ""),
        "contact_email":    body.get("contact_email", ""),
        "email":            body.get("email", {}),
        "interview_rounds": body.get("interview_rounds", []),
        "created_at":       datetime.now().isoformat(),
        "updated_at":       datetime.now().isoformat(),
        "timeline":         [timeline_event(status, "Application created")],
    }
