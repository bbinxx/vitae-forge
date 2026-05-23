import os
import json
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

_db = None

def get_firebase_db():
    global _db
    if _db is not None:
        return _db
    
    cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    
    try:
        if cred_path and Path(cred_path).exists():
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _db = firestore.client()
        elif cred_json:
            import json
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            _db = firestore.client()
        return _db
    except Exception as e:
        print(f"Firebase initialization failed: {e}")
        return None

def push_config_to_firebase(config_data: dict):
    db = get_firebase_db()
    if not db: return False
    try:
        db.collection("resume_system").document("live_config").set(config_data)
        return True
    except Exception as e:
        print(f"Firebase push config error: {e}")
        return False

def pull_config_from_firebase():
    db = get_firebase_db()
    if not db: return None
    try:
        doc = db.collection("resume_system").document("live_config").get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Firebase pull config error: {e}")
        return None

def push_checkpoint_to_firebase(name: str, config_data: dict):
    db = get_firebase_db()
    if not db: return False
    try:
        db.collection("checkpoints").document(name).set(config_data)
        return True
    except Exception as e:
        print(f"Firebase push checkpoint error: {e}")
        return False

def get_all_checkpoints_from_firebase():
    db = get_firebase_db()
    if not db: return []
    try:
        docs = db.collection("checkpoints").stream()
        return [doc.id for doc in docs]
    except Exception:
        return []

def push_template_to_firebase(name: str, content: str):
    db = get_firebase_db()
    if not db: return False
    try:
        db.collection("templates").document(name).set({"content": content})
        return True
    except Exception:
        return False

def get_settings():
    db = get_firebase_db()
    if not db: return {}
    try:
        doc = db.collection("resume_system").document("settings").get()
        if doc.exists:
            return doc.to_dict()
        return {}
    except Exception:
        return {}

def save_settings(settings: dict):
    db = get_firebase_db()
    if not db: return False
    try:
        db.collection("resume_system").document("settings").set(settings)
        return True
    except Exception:
        return False
