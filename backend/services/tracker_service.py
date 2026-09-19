import re
from datetime import datetime

from backend.db import db

def sanitize_filename(value: str, fallback: str = "app") -> str:
    if not value or not isinstance(value, str):
        return fallback
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip().replace(' ', '_'))
    cleaned = re.sub(r"_+", "_", cleaned).strip('_')
    return cleaned or fallback

def _get_name_prefix(user_id: str) -> str:
    """Resolve file name prefix: settings override > personal name > generic fallback."""
    try:
        settings = db.get_settings(user_id) if user_id else {}
        if isinstance(settings, dict) and settings.get("file_name_prefix"):
            return settings["file_name_prefix"]
        # Derive from personal.name
        personal = db.get_personal(user_id) if user_id else {}
        name = personal.get("name", "") if isinstance(personal, dict) else ""
        if name and name not in ("Your Name", "YOUR NAME", ""):
            safe = sanitize_filename(name, fallback="")
            if safe:
                return f"{safe}-"
    except Exception:
        pass
    return "Resume-"

def build_display_name(user_id: str, app: dict) -> str:
    raw_prefix = _get_name_prefix(user_id).strip("-_")
    role = app.get('role', '') if app else ''
    company = app.get('company', '') if app else ''
    
    parts = [p for p in (raw_prefix, role, company) if p]
    combined = "_".join(parts) if parts else "RESUME"
    
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", combined.replace(' ', '_'))
    cleaned = re.sub(r"_+", "_", cleaned).strip('_').upper()
    return cleaned or "RESUME"

def timeline_event(status: str, note: str = "") -> dict:
    return {
        "status": status,
        "date": datetime.now().isoformat(),
        "note": note,
    }

def default_app(app_id: str, body: dict) -> dict:
    status = body.get("status", "Bookmarked")
    company = body.get("company") or body.get("name") or body.get("company_name") or body.get("companyName") or ""
    role = body.get("role") or body.get("title") or body.get("job_title") or body.get("jobTitle") or body.get("position") or ""
    now_iso = datetime.now().isoformat()
    now_date = datetime.now().strftime("%Y-%m-%d")
    
    app_dict = {
        "id":               app_id,
        "company":          company,
        "role":             role,
        "location":         body.get("location", ""),
        "job_url":          body.get("job_url", ""),
        "status":           status,
        "priority":         body.get("priority", "Medium"),
        "job_type":         body.get("job_type", ""),
        "source":           body.get("source", ""),
        "platform":         body.get("platform", ""),
        "tags":             body.get("tags", []),
        "assigned_resume":      body.get("assigned_resume", ""),
        "assigned_pdf":         body.get("assigned_pdf", ""),
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
        "date_applied":     body.get("date_applied") or now_date,
        "created_at":       body.get("created_at") or now_iso,
        "updated_at":       now_iso,
        "timeline":         [timeline_event(status, "Application created")],
    }

    # Merge any additional custom keys provided in body
    for k, v in body.items():
        if k not in app_dict:
            app_dict[k] = v

    return app_dict


