"""Storage driver selection."""

from __future__ import annotations

from flask import current_app

from app.config import Settings
from app.storage.base import Storage, StoredFile
from app.storage.cloudinary_storage import CloudinaryStorage
from app.storage.local import LocalStorage

__all__ = ["Storage", "StoredFile", "get_storage"]


def _build(settings: Settings) -> Storage:
    if settings.MEDIA_BACKEND == "cloudinary":
        return CloudinaryStorage(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
        )
    return LocalStorage(settings.MEDIA_LOCAL_DIR, settings.API_PUBLIC_URL)


def get_storage() -> Storage:
    """The configured driver, built once per application."""
    storage = current_app.extensions.get("media_storage")
    if storage is None:
        storage = _build(current_app.extensions["settings"])
        current_app.extensions["media_storage"] = storage
    return storage
