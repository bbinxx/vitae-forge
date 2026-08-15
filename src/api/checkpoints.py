from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import src.services.checkpoint_service as cps

router = APIRouter(prefix="/checkpoints", tags=["checkpoints"])


def get_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


class CheckpointCreate(BaseModel):
    custom_name: str = ""


@router.get("")
def list_checkpoints(request: Request):
    user_id = get_user_id(request)
    return cps.list_checkpoints(user_id)


@router.post("")
def create_checkpoint(req: CheckpointCreate, request: Request):
    user_id = get_user_id(request)
    from src.services.resume_service import get_full_config
    config_data = get_full_config(user_id)
    name = cps.create_checkpoint(user_id, req.custom_name, config_data)
    return {"ok": True, "name": name}


@router.post("/{name}/restore")
def restore_checkpoint(name: str, request: Request):
    user_id = get_user_id(request)
    doc = cps.restore_checkpoint(user_id, name)
    if not doc:
        raise HTTPException(404, "Checkpoint not found")
    return {"ok": True, "source": name}


@router.delete("/{name}")
def delete_checkpoint(name: str, request: Request):
    user_id = get_user_id(request)
    cps.delete_checkpoint(user_id, name)
    return {"ok": True}
