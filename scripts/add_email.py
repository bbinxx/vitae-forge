#!/usr/bin/env python3
"""Set or update email for existing users."""
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

from src.services.user_service import list_users, set_user_email


def main():
    users = list_users()
    if not users:
        print("No users found.")
        return

    print("Existing users:")
    print(f"{'#':<4} {'Username':<25} {'Email':<35} {'User ID'}")
    print("-" * 90)
    for i, u in enumerate(users, 1):
        print(f"{i:<4} {u.get('username', '?'):<25} {u.get('email', '-'):<35} {u.get('id', '?')}")

    print()
    try:
        choice = input("Enter user # to update email (or 'q' to quit): ").strip()
        if choice.lower() == 'q':
            return
        idx = int(choice) - 1
        if idx < 0 or idx >= len(users):
            print("Invalid selection.")
            return
    except (ValueError, IndexError):
        print("Invalid selection.")
        return

    user = users[idx]
    print(f"\nSelected: {user.get('username', '?')} ({user.get('email', 'no email')})")

    new_email = input("Enter new email address: ").strip()
    if not new_email or '@' not in new_email:
        print("Invalid email address.")
        return

    result = set_user_email(user["id"], new_email)
    if result:
        print(f"Email set to: {result['email']}")
    else:
        print("Failed to set email. It may already be in use.")


if __name__ == "__main__":
    main()
