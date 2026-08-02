from src.db import db
from typing import List, Dict, Any, Optional
from datetime import datetime

def list_checkpoints(user_id: str) -> List[Dict[str, Any]]:
    cps = db.list_checkpoints(user_id)
    result = []
    # Fetch actual metadata or fallback to parsed name if no metadata stored
    for name in cps:
        doc = db.get_checkpoint(user_id, name)
        if doc and "created_at" in doc:
            created = doc["created_at"]
        else:
            # Fallback for old/flat format if any
            created = datetime.now().isoformat()
        result.append({
            "name": name,
            "created": created
        })
    return sorted(result, key=lambda x: x["created"], reverse=True)

def create_checkpoint(user_id: str, custom_name: str, config_data: Dict[str, Any]) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    clean_name = custom_name.strip().replace(" ", "_").replace("/", "-")
    name = f"checkpoint_{clean_name}_{timestamp}" if clean_name else f"checkpoint_{timestamp}"
    
    # Wrap config with metadata
    data = {
        "created_at": datetime.now().isoformat(),
        "config": config_data
    }
    db.save_checkpoint(user_id, name, data)
    return name

def restore_checkpoint(user_id: str, name: str) -> Optional[Dict[str, Any]]:
    from src.services.resume_service import save_full_config
    doc = db.get_checkpoint(user_id, name)
    if doc and "config" in doc:
        save_full_config(user_id, doc["config"])
        return doc["config"]
    # Fallback if doc is directly the config
    elif doc:
        save_full_config(user_id, doc)
        return doc
    return None

def delete_checkpoint(user_id: str, name: str) -> None:
    db.delete_checkpoint(user_id, name)
