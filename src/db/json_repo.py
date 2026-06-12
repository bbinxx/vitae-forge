import json
import os
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Any

from src.db.repository import AbstractRepository
from src.core.config import ROOT

DB_DIR = ROOT / "dist" / "local_db"

class JSONRepository(AbstractRepository):
    def __init__(self):
        self._db_dir = DB_DIR
        self._db_dir.mkdir(parents=True, exist_ok=True)
        self._users_file = self._db_dir / "users.json"
        
        if not self._users_file.exists():
            self._write_json(self._users_file, {})

    def _read_json(self, path: Path) -> dict:
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text())
        except Exception:
            return {}

    def _write_json(self, path: Path, data: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2))

    def _user_dir(self, user_id: str) -> Path:
        d = self._db_dir / "users" / user_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ── Users ──
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        users = self._read_json(self._users_file)
        for uid, u in users.items():
            if u.get("username") == username:
                return u
        return None
        
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        users = self._read_json(self._users_file)
        return users.get(user_id)

    def save_user(self, user_id: str, user: Dict[str, Any]) -> None:
        users = self._read_json(self._users_file)
        if user_id in users:
            users[user_id].update(user)
        else:
            users[user_id] = user
        self._write_json(self._users_file, users)

    def list_users(self) -> List[Dict[str, Any]]:
        users = self._read_json(self._users_file)
        return list(users.values())

    # ── Resume Data (per-user) ──
    def _get_doc(self, user_id: str, doc_name: str) -> Dict[str, Any]:
        p = self._user_dir(user_id) / f"{doc_name}.json"
        return self._read_json(p)

    def _save_doc(self, user_id: str, doc_name: str, data: Dict[str, Any]) -> None:
        p = self._user_dir(user_id) / f"{doc_name}.json"
        self._write_json(p, data)

    def get_personal(self, user_id: str) -> Dict[str, Any]:
        return self._get_doc(user_id, "personal")

    def save_personal(self, user_id: str, data: Dict[str, Any]) -> None:
        self._save_doc(user_id, "personal", data)

    def get_library(self, user_id: str) -> Dict[str, Any]:
        return self._get_doc(user_id, "library")

    def save_library(self, user_id: str, data: Dict[str, Any]) -> None:
        self._save_doc(user_id, "library", data)

    def get_recipes(self, user_id: str) -> Dict[str, Any]:
        return self._get_doc(user_id, "recipes")

    def save_recipes(self, user_id: str, data: Dict[str, Any]) -> None:
        self._save_doc(user_id, "recipes", data)

    def get_recipe(self, user_id: str, recipe_id: str) -> Optional[Dict[str, Any]]:
        return self.get_recipes(user_id).get(recipe_id)

    # ── Applications (per-user) ──
    def _apps_file(self, user_id: str) -> Path:
        return self._user_dir(user_id) / "applications.json"

    def get_all_applications(self, user_id: str) -> List[Dict[str, Any]]:
        apps = self._read_json(self._apps_file(user_id))
        return list(apps.values())

    def get_application(self, user_id: str, app_id: str) -> Optional[Dict[str, Any]]:
        return self._read_json(self._apps_file(user_id)).get(app_id)

    def save_application(self, user_id: str, app: Dict[str, Any]) -> None:
        app_id = app.get("id")
        if not app_id: return
        apps = self._read_json(self._apps_file(user_id))
        apps[app_id] = app
        self._write_json(self._apps_file(user_id), apps)

    def delete_application(self, user_id: str, app_id: str) -> None:
        apps = self._read_json(self._apps_file(user_id))
        if app_id in apps:
            del apps[app_id]
            self._write_json(self._apps_file(user_id), apps)

    def _versions_file(self, user_id: str, app_id: str) -> Path:
        return self._user_dir(user_id) / f"versions_{app_id}.json"

    def get_app_versions(self, user_id: str, app_id: str) -> List[Dict[str, Any]]:
        versions = self._read_json(self._versions_file(user_id, app_id))
        return list(versions.values())

    def save_app_version(self, user_id: str, app_id: str, version_data: Dict[str, Any]) -> None:
        v_id = version_data.get("id")
        if not v_id: return
        versions = self._read_json(self._versions_file(user_id, app_id))
        versions[v_id] = version_data
        self._write_json(self._versions_file(user_id, app_id), versions)

    def get_app_version(self, user_id: str, app_id: str, v_id: str) -> Optional[Dict[str, Any]]:
        return self._read_json(self._versions_file(user_id, app_id)).get(v_id)

    def delete_app_version(self, user_id: str, app_id: str, v_id: str) -> bool:
        versions = self._read_json(self._versions_file(user_id, app_id))
        if v_id in versions:
            del versions[v_id]
            self._write_json(self._versions_file(user_id, app_id), versions)
            return True
        return False

    # ── Checkpoints (per-user) ──
    def _checkpoints_file(self, user_id: str) -> Path:
        return self._user_dir(user_id) / "checkpoints.json"

    def list_checkpoints(self, user_id: str) -> List[str]:
        return list(self._read_json(self._checkpoints_file(user_id)).keys())

    def save_checkpoint(self, user_id: str, name: str, data: Dict[str, Any]) -> None:
        cps = self._read_json(self._checkpoints_file(user_id))
        cps[name] = data
        self._write_json(self._checkpoints_file(user_id), cps)

    def get_checkpoint(self, user_id: str, name: str) -> Optional[Dict[str, Any]]:
        return self._read_json(self._checkpoints_file(user_id)).get(name)

    def delete_checkpoint(self, user_id: str, name: str) -> None:
        cps = self._read_json(self._checkpoints_file(user_id))
        if name in cps:
            del cps[name]
            self._write_json(self._checkpoints_file(user_id), cps)

    # ── Settings (per-user) ──
    def get_settings(self, user_id: str) -> Dict[str, Any]:
        return self._get_doc(user_id, "settings")

    def save_settings(self, user_id: str, data: Dict[str, Any]) -> None:
        self._save_doc(user_id, "settings", data)
