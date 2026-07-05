import bcrypt
import uuid
from typing import Optional, Dict, Any, List
from src.db import db

def create_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    if db.get_user_by_email(email):
        return None

    user_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    user_data = {
        "id": user_id,
        "email": email,
        "username": email.split("@")[0],
        "password_hash": hashed
    }
    db.save_user(user_id, user_data)
    return user_data

def authenticate_user(login: str, password: str) -> Optional[Dict[str, Any]]:
    user = db.get_user_by_email(login)
    if not user:
        user = db.get_user(login)

    if not user:
        return None

    pw_hash = user.get("password_hash")
    if not pw_hash:
        return None

    if bcrypt.checkpw(password.encode("utf-8"), pw_hash.encode("utf-8")):
        return user
    return None

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return db.get_user_by_id(user_id)

def list_users() -> List[Dict[str, Any]]:
    return db.list_users()

def set_user_email(user_id: str, email: str) -> Optional[Dict[str, Any]]:
    if db.get_user_by_email(email):
        return None
    user = db.get_user_by_id(user_id)
    if not user:
        return None
    user["email"] = email
    user["username"] = email.split("@")[0]
    db.save_user(user_id, user)
    return user
