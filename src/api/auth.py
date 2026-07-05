import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from jose import jwt, JWTError

from src.services.user_service import authenticate_user, create_user, get_user_by_id, set_user_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-default-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str

class SetEmailRequest(BaseModel):
    email: str

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
def login(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"], "email": user.get("email", ""), "username": user.get("username", "")},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user["id"], "email": user.get("email", ""), "username": user.get("username", "")}}

@router.post("/register")
def register(req: RegisterRequest):
    user = create_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=400, detail="Email already registered")

    from src.db.seed import seed_new_user
    seed_new_user(user["id"])

    return {"ok": True, "user": {"id": user["id"], "email": user["email"], "username": user["username"]}}

@router.get("/me")
def read_users_me(request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"id": user.get("id", user_id), "email": user.get("email", ""), "username": user.get("username", "")}

@router.post("/set-email")
def set_email(req: SetEmailRequest, request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = set_user_email(user_id, req.email)
    if not result:
        raise HTTPException(status_code=400, detail="Email already in use or user not found")

    return {"ok": True, "email": result["email"]}
