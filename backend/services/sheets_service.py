import json
import threading
import requests
from backend.db import db

def _post_to_google_script(url: str, payload: dict, timeout: int = 15):
    """
    Posts JSON payload to Google Apps Script URL.
    Google Apps Script responds to POST with a 302 Found redirect to script.googleusercontent.com.
    Standard requests library changes POST -> GET on 302 redirect. We explicitly re-POST to the
    redirect target Location header to preserve postData in Google Apps Script.
    """
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308) and "Location" in resp.headers:
            redirect_url = resp.headers["Location"]
            resp = requests.post(redirect_url, json=payload, headers=headers, timeout=timeout)
        return resp
    except Exception as e:
        print(f"[Google Sheets Sync] Request error: {e}")
        return None

def _send_webhook_async(url: str, payload: dict):
    def worker():
        _post_to_google_script(url, payload, timeout=10)

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

    resp = _post_to_google_script(webhook_url, payload, timeout=15)
    if resp and resp.status_code == 200:
        return {"ok": True, "count": len(serialized_apps), "message": f"Successfully synced {len(serialized_apps)} applications to Google Sheet."}
    else:
        err_detail = resp.text[:200] if resp else "No response from Google Apps Script"
        return {"ok": False, "message": f"Google Sheets Sync Notice: {err_detail}"}
