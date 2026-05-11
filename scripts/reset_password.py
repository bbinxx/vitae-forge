#!/usr/bin/env python3
"""Reset a user's password by username."""
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

import bcrypt
from src.db import db

def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/reset_password.py <username> <new_password>")
        print("Example: python scripts/reset_password.py admin1 mynewpass123")
        sys.exit(1)

    username = sys.argv[1]
    new_password = sys.argv[2]

    user = db.get_user(username)
    if not user:
        print(f"User '{username}' not found.")
        sys.exit(1)

    hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user["password_hash"] = hashed

    user_id = user.get("id")
    if not user_id:
        users_col = db.db.collection("users").where("username", "==", username).limit(1).stream()
        for doc in users_col:
            user_id = doc.id
            break

    if not user_id:
        print(f"Could not find document ID for '{username}'.")
        sys.exit(1)

    db.save_user(user_id, user)
    print(f"Password reset for '{username}' successfully.")

if __name__ == "__main__":
    main()
