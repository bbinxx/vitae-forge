import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from jose import jwt

from backend.services.user_service import authenticate_user, create_user, get_user_by_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-default-key-change-in-prod")
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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login")
def login(req: LoginRequest, response: Response):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"], "username": user["username"]},
        expires_delta=access_token_expires
    )
    
    # Set auth_token in HTTP response cookie
    response.set_cookie(
        key="auth_token",
        value=access_token,
        max_age=604800,
        httponly=False,
        samesite="lax",
        path="/"
    )
    
    return {
        "ok": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"]}
    }

@router.post("/register")
def register(req: RegisterRequest, response: Response):
    if not req.username or len(req.username.trim()) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if not req.password or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    user = create_user(req.username.trim(), req.password)
    if not user:
        raise HTTPException(status_code=400, detail="Username is already taken")
    
    # Trigger seeding for new user
    try:
        from backend.db.seed import seed_user_data
        seed_user_data(user["id"])
    except Exception as e:
        print(f"User seed warning: {e}")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"], "username": user["username"]},
        expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="auth_token",
        value=access_token,
        max_age=604800,
        httponly=False,
        samesite="lax",
        path="/"
    )
    
    return {
        "ok": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"]}
    }

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="auth_token", path="/")
    return {"ok": True, "message": "Logged out successfully"}

@router.get("/me")
def read_users_me(request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        # Fallback to default user if auth not enforced
        auth_required = os.environ.get("AUTH_REQUIRED", "false").lower() == "true"
        if not auth_required:
            return {"id": "default_user", "username": "Default User", "authenticated": False}
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    user = get_user_by_id(user_id)
    if not user:
        return {"id": user_id, "username": user_id, "authenticated": True}
        
    return {"id": user["id"], "username": user["username"], "authenticated": True}

