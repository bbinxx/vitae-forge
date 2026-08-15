"""
backend/core/deps.py
Shared FastAPI dependencies across all API routers.
"""
from fastapi import Request, HTTPException

def get_user_id(request: Request = None) -> str:
    """Extract authenticated user_id set by auth middleware, falling back to 'default_user'."""
    if not request:
        return "default_user"
    return getattr(request.state, "user_id", None) or "default_user"

def get_optional_user_id(request: Request = None) -> str:
    """Extract user_id if present, falling back to 'default_user'."""
    if not request:
        return "default_user"
    return getattr(request.state, "user_id", None) or "default_user"
