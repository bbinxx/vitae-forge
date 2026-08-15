from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any

class AbstractRepository(ABC):
    # ── Users ──
    @abstractmethod
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        pass
        
    @abstractmethod
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def save_user(self, user_id: str, user: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def list_users(self) -> List[Dict[str, Any]]:
        pass

    # ── Resume Data (per-user) ──
    @abstractmethod
    def get_personal(self, user_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def save_personal(self, user_id: str, data: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def get_library(self, user_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def save_library(self, user_id: str, data: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def get_recipes(self, user_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def save_recipes(self, user_id: str, data: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def get_recipe(self, user_id: str, recipe_id: str) -> Optional[Dict[str, Any]]:
        pass

    # ── Applications (per-user) ──
    @abstractmethod
    def get_all_applications(self, user_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_application(self, user_id: str, app_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def save_application(self, user_id: str, app: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def delete_application(self, user_id: str, app_id: str) -> None:
        pass

    @abstractmethod
    def get_app_versions(self, user_id: str, app_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def save_app_version(self, user_id: str, app_id: str, version_data: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def get_app_version(self, user_id: str, app_id: str, v_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete_app_version(self, user_id: str, app_id: str, v_id: str) -> bool:
        pass

    # ── Checkpoints (per-user) ──
    @abstractmethod
    def list_checkpoints(self, user_id: str) -> List[str]:
        pass

    @abstractmethod
    def save_checkpoint(self, user_id: str, name: str, data: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def get_checkpoint(self, user_id: str, name: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete_checkpoint(self, user_id: str, name: str) -> None:
        pass

    # ── Settings (per-user) ──
    @abstractmethod
    def get_settings(self, user_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def save_settings(self, user_id: str, data: Dict[str, Any]) -> None:
        pass
