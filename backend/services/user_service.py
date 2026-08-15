import os
import bcrypt
import uuid
from typing import Optional, Dict, Any, List
from backend.db import db

def create_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    # Check if user exists
    if db.get_user(username):
        return None
        
    user_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    user_data = {
        "id": user_id,
        "username": username,
        "password_hash": hashed
    }
    db.save_user(user_id, user_data)
    return user_data

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    # 1. Env Passcode Check (Admin / Passcode direct access)
    passcode = os.environ.get("PASSCODE")
    passcode_hash = os.environ.get("PASSCODE_HASH")
    
    if passcode and password == passcode:
        return {"id": "admin_user", "username": username or "admin"}
        
    if passcode_hash:
        try:
            if bcrypt.checkpw(password.encode("utf-8"), passcode_hash.encode("utf-8")):
                return {"id": "admin_user", "username": username or "admin"}
        except Exception:
            if password == passcode_hash:
                return {"id": "admin_user", "username": username or "admin"}

    # 2. Database User Check
    user = db.get_user(username)
    if not user:
        return None
        
    if bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return user
    return None

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    if user_id == "admin_user":
        return {"id": "admin_user", "username": "admin"}
    return db.get_user_by_id(user_id)

def list_users() -> List[Dict[str, Any]]:
    return db.list_users()
