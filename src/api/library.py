from fastapi import APIRouter, HTTPException, Request

from src.services.resume_service import (
    get_library_section,
    get_library_item,
    update_library_item,
    delete_library_item
)
from src.db import db

router = APIRouter(prefix="/api/library", tags=["library"])

def get_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id

@router.get("/{section}")
def read_library_section(section: str, request: Request):
    user_id = get_user_id(request)
    return get_library_section(user_id, section)

@router.get("/{section}/{key}")
def read_library_item(section: str, key: str, request: Request):
    user_id = get_user_id(request)
    item = get_library_item(user_id, section, key)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/{section}/{key}")
async def write_library_item(section: str, key: str, request: Request):
    user_id = get_user_id(request)
    data = await request.json()
    update_library_item(user_id, section, key, data)
    return {"ok": True, "item": data}

@router.delete("/{section}/{key}")
def remove_library_item(section: str, key: str, request: Request):
    user_id = get_user_id(request)
    success = delete_library_item(user_id, section, key)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}

# Recipe endpoints
@router.get("/recipes/all")
def read_recipes(request: Request):
    user_id = get_user_id(request)
    return db.get_recipes(user_id)

@router.post("/recipes/{recipe_id}")
async def write_recipe(recipe_id: str, request: Request):
    user_id = get_user_id(request)
    data = await request.json()
    recipes = db.get_recipes(user_id)
    recipes[recipe_id] = data
    db.save_recipes(user_id, recipes)
    return {"ok": True, "recipe": data}

@router.delete("/recipes/{recipe_id}")
def remove_recipe(recipe_id: str, request: Request):
    user_id = get_user_id(request)
    recipes = db.get_recipes(user_id)
    if recipe_id in recipes:
        del recipes[recipe_id]
        db.save_recipes(user_id, recipes)
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Recipe not found")
