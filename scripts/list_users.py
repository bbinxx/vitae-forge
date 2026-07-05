#!/usr/bin/env python3
"""List all registered usernames. No passwords or hashes are exposed."""
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

from src.db import db

def main():
    users = db.list_users()
    if not users:
        print("No users found.")
        return
    print(f"{'#':<4} {'Email':<35} {'Username':<25} {'User ID'}")
    print("-" * 95)
    for i, u in enumerate(users, 1):
        print(f"{i:<4} {u.get('email', '-'):<35} {u.get('username', '?'):<25} {u.get('id', '?')}")
    print(f"\nTotal: {len(users)} user(s)")

if __name__ == "__main__":
    main()
