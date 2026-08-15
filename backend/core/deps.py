"""
backend/core/deps.py
Shared FastAPI dependencies across all API routers.
"""
from fastapi import Request, HTTPException

def get_user_id(request: Request) -> str:
    """Extract authenticated user_id set by auth middleware."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id

def get_optional_user_id(request: Request = None) -> str | None:
    """Extract user_id if present, otherwise return None."""
    if not request:
        return None
    return getattr(request.state, "user_id", None)
