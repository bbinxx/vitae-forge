import bcrypt
import uuid
from typing import Optional, Dict, Any, List
from backend.db import db

def create_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    user_data = {
        "id": user_id,
        "username": username,
        "password_hash": hashed
    }
    return user_data if db.create_user(user_id, user_data) else None

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        return None
    user = db.get_user(username)
    password_hash = user.get("password_hash") if user else None
    if not isinstance(password_hash, str):
        return None
    try:
        if bcrypt.checkpw(encoded, password_hash.encode("utf-8")):
            return user
    except ValueError:
        return None
    return None

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return db.get_user_by_id(user_id)

def list_users() -> List[Dict[str, Any]]:
    return db.list_users()
