import json
import threading
import requests
from backend.db import db

def _send_webhook_async(url: str, payload: dict):
    def worker():
        try:
            requests.post(url, json=payload, timeout=10)
        except Exception as e:
            print(f"[Google Sheets Sync] Webhook notify error: {e}")

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def sync_application_to_sheets(user_id: str, app: dict, action: str = "upsert"):
    """
    Sends application update/deletion event to configured Google Apps Script Webhook URL.
    Includes full application details and resume_template JSON string.
    """
    try:
        settings = db.get_settings(user_id) if user_id else {}
        webhook_url = settings.get("google_sheets_webhook_url", "").strip() if isinstance(settings, dict) else ""
        if not webhook_url:
            return

        payload = {
            "action": action,
            "application": {
                "id": app.get("id", ""),
                "company": app.get("company", ""),
                "role": app.get("role", ""),
                "status": app.get("status", "APPLIED"),
                "priority": app.get("priority", "MEDIUM"),
                "date_applied": app.get("date_applied") or app.get("created_at", "").split("T")[0],
                "contact_name": app.get("contact_name", ""),
                "contact_email": app.get("contact_email", ""),
                "job_url": app.get("job_url", ""),
                "notes": app.get("notes", ""),
                "resume_template_json": json.dumps(app.get("resume_template", {}), ensure_ascii=False),
                "created_at": app.get("created_at", ""),
                "updated_at": app.get("updated_at", "")
            }
        }
        _send_webhook_async(webhook_url, payload)
    except Exception as e:
        print(f"[Google Sheets Sync] Service error: {e}")

def sync_all_applications_to_sheets(user_id: str) -> dict:
    """
    Backfills all existing applications into the user's Google Sheet at once.
    """
    settings = db.get_settings(user_id) if user_id else {}
    webhook_url = settings.get("google_sheets_webhook_url", "").strip() if isinstance(settings, dict) else ""
    if not webhook_url:
        return {"ok": False, "message": "Google Sheets Webhook URL is not configured in Settings."}

    apps = db.get_all_applications(user_id)
    serialized_apps = []
    for app in apps:
        serialized_apps.append({
            "id": app.get("id", ""),
            "company": app.get("company", ""),
            "role": app.get("role", ""),
            "status": app.get("status", "APPLIED"),
            "priority": app.get("priority", "MEDIUM"),
            "date_applied": app.get("date_applied") or app.get("created_at", "").split("T")[0],
            "contact_name": app.get("contact_name", ""),
            "contact_email": app.get("contact_email", ""),
            "job_url": app.get("job_url", ""),
            "notes": app.get("notes", ""),
            "resume_template_json": json.dumps(app.get("resume_template", {}), ensure_ascii=False),
            "created_at": app.get("created_at", ""),
            "updated_at": app.get("updated_at", "")
        })

    payload = {
        "action": "sync_all",
        "applications": serialized_apps
    }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=15)
        return {"ok": True, "count": len(serialized_apps), "message": f"Successfully synced {len(serialized_apps)} applications to Google Sheet."}
    except Exception as e:
        return {"ok": False, "message": f"Failed to reach Google Sheets Webhook: {str(e)}"}
