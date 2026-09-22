"""Cloudinary storage. Production.

Uploads are signed here on the server, so the API secret never reaches a
browser. Cloudinary then serves the image from its CDN, off the club's own
instance, resizing per device from the delivery URL.
"""

from __future__ import annotations

from io import BytesIO

import cloudinary
import cloudinary.uploader

from app.storage.base import StoredFile

FOLDER = "kitengela-marines"


class CloudinaryStorage:
    def __init__(self, cloud_name: str, api_key: str, api_secret: str) -> None:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
        )

    def save(self, data: bytes, *, key: str, content_type: str) -> StoredFile:
        result = cloudinary.uploader.upload(
            BytesIO(data),
            public_id=f"{FOLDER}/{key.rsplit('.', 1)[0]}",
            resource_type="image",
            # Our key is already unique; let Cloudinary neither rename it nor
            # silently replace an existing asset.
            overwrite=False,
            unique_filename=False,
            use_filename=False,
        )
        return StoredFile(key=str(result["public_id"]), url=str(result["secure_url"]))

    def delete(self, key: str) -> None:
        cloudinary.uploader.destroy(key, resource_type="image", invalidate=True)
