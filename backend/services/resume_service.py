from backend.db import db
from typing import Dict, Any, Optional

PERSONAL_FIELDS = ("name", "email", "phone", "linkedin", "github")


def merge_personal(base: Optional[Dict[str, Any]], *sources: Any) -> Dict[str, Any]:
    """Merge contact details without letting partial/empty values erase real ones.

    Saved recipes and application templates often contain an incomplete
    ``personal`` block (e.g. only a name). A plain ``dict.update`` would wipe
    the user's email from the master profile, so empty incoming values are
    ignored here.
    """
    personal = dict(base or {})
    for source in sources:
        if not isinstance(source, dict):
            continue
        nested = source.get("personal")
        if isinstance(nested, dict):
            for key, value in nested.items():
                if value not in (None, ""):
                    personal[key] = value
        for field in PERSONAL_FIELDS:
            value = source.get(field)
            # Top-level ``email`` is often the cover-letter payload
            # ({"to", "cc", "subject", "body"}), not the contact address.
            # Never let a non-string value overwrite a contact field.
            if isinstance(value, str) and value.strip():
                personal[field] = value
    return personal


def get_full_config(user_id: str) -> Dict[str, Any]:
    """Merge personal, library, and recipes into the full config format."""
    try:
        personal = db.get_personal(user_id)
        library = db.get_library(user_id)
        recipes = db.get_recipes(user_id)
        return {
            "personal": personal,
            "library": library,
            "recipes": recipes
        }
    except Exception:
        from backend.core.config import load_resume_config
        return load_resume_config()

def save_full_config(user_id: str, data: Dict[str, Any]) -> None:
    """Split full config into its components and save."""
    if "personal" in data:
        db.save_personal(user_id, data["personal"])
    if "library" in data:
        db.save_library(user_id, data["library"])
    if "recipes" in data:
        db.save_recipes(user_id, data["recipes"])

def get_library_section(user_id: str, section: str) -> Dict[str, Any]:
    lib = db.get_library(user_id)
    return lib.get(section, {})

def get_library_item(user_id: str, section: str, key: str) -> Optional[Dict[str, Any]]:
    lib = db.get_library(user_id)
    return lib.get(section, {}).get(key)

def update_library_item(user_id: str, section: str, key: str, data: Dict[str, Any]) -> None:
    lib = db.get_library(user_id)
    if section not in lib:
        lib[section] = {}
    lib[section][key] = data
    db.save_library(user_id, lib)

def delete_library_item(user_id: str, section: str, key: str) -> bool:
    lib = db.get_library(user_id)
    if section in lib and key in lib[section]:
        del lib[section][key]
        db.save_library(user_id, lib)
        return True
    return False
