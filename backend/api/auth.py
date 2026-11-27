import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from jose import jwt

from backend.services.user_service import authenticate_user, create_user, get_user_by_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

_configured_key = os.environ.get("JWT_SECRET", "")
if not _configured_key.strip() or _configured_key.strip() == "super-secret-default-key-change-in-prod":
    _configured_key = ""
SECRET_KEY = _configured_key or secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def validate_auth_configuration() -> None:
    if os.environ.get("AUTH_REQUIRED", "false").lower() == "true" and not _configured_key:
        raise RuntimeError("Set a private JWT_SECRET when AUTH_REQUIRED=true")


def _start_session(user: dict, request: Request, response: Response) -> dict:
    session_user = {"id": user["id"], "username": user["username"]}
    token = create_access_token(
        {"sub": session_user["id"], "username": session_user["username"]},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    response.set_cookie(
        key="auth_token",
        value=token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )
    return {"ok": True, "access_token": token, "token_type": "bearer", "user": session_user}


@router.post("/login")
def login(req: LoginRequest, request: Request, response: Response):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return _start_session(user, request, response)


@router.post("/register")
def register(req: RegisterRequest, request: Request, response: Response):
    username = req.username.strip()
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if len(req.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must fit within 72 UTF-8 bytes")
    if "\x00" in username:
        raise HTTPException(status_code=400, detail="Invalid username")

    user = create_user(username, req.password)
    if not user:
        raise HTTPException(status_code=400, detail="Username is already taken")
    return _start_session(user, request, response)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="auth_token", path="/")
    return {"ok": True, "message": "Logged out successfully"}

@router.get("/me")
def read_users_me(request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    return {"id": user["id"], "username": user["username"], "authenticated": True}
