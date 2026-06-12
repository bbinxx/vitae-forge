import os
import sys

from src.db import db
from src.services.user_service import create_user, authenticate_user
from src.db.seed import seed_user_data

print("Connecting to DB...")
users = db.list_users()
print(f"Current users: {len(users)}")

print("Registering new user testuser...")
user = create_user("testuser", "password123")
if user:
    print(f"Created user: {user['id']}")
    seed_user_data(user['id'])
    print("Seed complete.")
else:
    print("User already exists, authenticating...")
    user = authenticate_user("testuser", "password123")
    print(f"Authenticated user: {user['id']}")

print("Done.")
