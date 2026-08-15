import os
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

import firebase_admin
from firebase_admin import credentials, firestore

from backend.db.repository import AbstractRepository

_CACHE_TTL_SECONDS = 30


class FirestoreRepository(AbstractRepository):
    def __init__(self):
        self._db = None
        self._initialize_firebase()
        self._apps_cache = {}
        self._app_versions_cache = {}

    def _initialize_firebase(self):
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
        cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        
        try:
            # Check if default app is already initialized
            try:
                firebase_admin.get_app()
                self._db = firestore.client()
                return
            except ValueError:
                pass
            
            if cred_path and Path(cred_path).exists():
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                self._db = firestore.client()
            elif cred_json:
                import json
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                self._db = firestore.client()
        except Exception as e:
            print(f"Firebase initialization failed: {e}")

    @property
    def db(self):
        if not self._db:
            self._initialize_firebase()
        if not self._db:
            raise RuntimeError("Firestore DB not initialized")
        return self._db

    def _user_ref(self, user_id: str):
        return self.db.collection("users").document(user_id)

    # ── Users ──
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        users = self.db.collection("users").where("username", "==", username).limit(1).stream()
        for u in users:
            return u.to_dict()
        return None
        
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        doc = self._user_ref(user_id).get()
        if doc.exists:
            return doc.to_dict()
        return None

    def save_user(self, user_id: str, user: Dict[str, Any]) -> None:
        self._user_ref(user_id).set(user, merge=True)

    def list_users(self) -> List[Dict[str, Any]]:
        return [doc.to_dict() for doc in self.db.collection("users").stream()]

    # ── Resume Data (per-user) ──
    def get_personal(self, user_id: str) -> Dict[str, Any]:
        doc = self._user_ref(user_id).collection("resume_data").document("personal").get()
        return doc.to_dict() if doc.exists else {}

    def save_personal(self, user_id: str, data: Dict[str, Any]) -> None:
        self._user_ref(user_id).collection("resume_data").document("personal").set(data)

    def get_library(self, user_id: str) -> Dict[str, Any]:
        doc = self._user_ref(user_id).collection("resume_data").document("library").get()
        return doc.to_dict() if doc.exists else {}

    def save_library(self, user_id: str, data: Dict[str, Any]) -> None:
        self._user_ref(user_id).collection("resume_data").document("library").set(data)

    def get_recipes(self, user_id: str) -> Dict[str, Any]:
        doc = self._user_ref(user_id).collection("resume_data").document("recipes").get()
        return doc.to_dict() if doc.exists else {}

    def save_recipes(self, user_id: str, data: Dict[str, Any]) -> None:
        self._user_ref(user_id).collection("resume_data").document("recipes").set(data)

    def get_recipe(self, user_id: str, recipe_id: str) -> Optional[Dict[str, Any]]:
        recipes = self.get_recipes(user_id)
        return recipes.get(recipe_id)

    # ── Applications (per-user) ──
    def get_all_applications(self, user_id: str) -> List[Dict[str, Any]]:
        cached = self._apps_cache.get(user_id)
        if cached and time.time() - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]
        docs = self._user_ref(user_id).collection("applications").stream()
        res = [doc.to_dict() for doc in docs]
        self._apps_cache[user_id] = (time.time(), res)
        return res

    def get_application(self, user_id: str, app_id: str) -> Optional[Dict[str, Any]]:
        doc = self._user_ref(user_id).collection("applications").document(app_id).get()
        return doc.to_dict() if doc.exists else None

    def save_application(self, user_id: str, app: Dict[str, Any]) -> None:
        self._apps_cache.pop(user_id, None)
        app_id = app.get("id")
        if not app_id:
            return
        self._user_ref(user_id).collection("applications").document(app_id).set(app)

    def delete_application(self, user_id: str, app_id: str) -> None:
        self._apps_cache.pop(user_id, None)
        self._user_ref(user_id).collection("applications").document(app_id).delete()

    def get_app_versions(self, user_id: str, app_id: str) -> List[Dict[str, Any]]:
        key = (user_id, app_id)
        cached = self._app_versions_cache.get(key)
        if cached and time.time() - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]
        docs = self._user_ref(user_id).collection("applications").document(app_id).collection("versions").stream()
        res = [doc.to_dict() for doc in docs]
        self._app_versions_cache[key] = (time.time(), res)
        return res

    def save_app_version(self, user_id: str, app_id: str, version_data: Dict[str, Any]) -> None:
        self._app_versions_cache.pop((user_id, app_id), None)
        v_id = version_data.get("id")
        if not v_id:
            return
        self._user_ref(user_id).collection("applications").document(app_id).collection("versions").document(v_id).set(version_data)

    def get_app_version(self, user_id: str, app_id: str, v_id: str) -> Optional[Dict[str, Any]]:
        doc = self._user_ref(user_id).collection("applications").document(app_id).collection("versions").document(v_id).get()
        return doc.to_dict() if doc.exists else None

    def delete_app_version(self, user_id: str, app_id: str, v_id: str) -> bool:
        self._app_versions_cache.pop((user_id, app_id), None)
        try:
            self._user_ref(user_id).collection("applications").document(app_id).collection("versions").document(v_id).delete()
            return True
        except Exception:
            return False

    # ── Checkpoints (per-user) ──
    def list_checkpoints(self, user_id: str) -> List[str]:
        docs = self._user_ref(user_id).collection("checkpoints").stream()
        return [doc.id for doc in docs]

    def save_checkpoint(self, user_id: str, name: str, data: Dict[str, Any]) -> None:
        self._user_ref(user_id).collection("checkpoints").document(name).set(data)

    def get_checkpoint(self, user_id: str, name: str) -> Optional[Dict[str, Any]]:
        doc = self._user_ref(user_id).collection("checkpoints").document(name).get()
        return doc.to_dict() if doc.exists else None

    def delete_checkpoint(self, user_id: str, name: str) -> None:
        self._user_ref(user_id).collection("checkpoints").document(name).delete()

    # ── Settings (per-user) ──
    def get_settings(self, user_id: str) -> Dict[str, Any]:
        doc = self._user_ref(user_id).collection("resume_data").document("settings").get()
        return doc.to_dict() if doc.exists else {}

    def save_settings(self, user_id: str, data: Dict[str, Any]) -> None:
        self._user_ref(user_id).collection("resume_data").document("settings").set(data)
