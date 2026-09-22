"""Serves locally stored media in development.

Registered only when MEDIA_BACKEND is local. In production Cloudinary serves
the files and this blueprint does not exist.
"""

from __future__ import annotations

from flask import Blueprint, Response, abort, current_app, send_from_directory

from app.storage.local import SAFE_KEY

media_bp = Blueprint("media", __name__, url_prefix="/media")


@media_bp.get("/<key>")
def serve_media(key: str) -> Response:
    if not SAFE_KEY.match(key):
        abort(404)

    storage = current_app.extensions["media_storage"]
    # Filenames are content-addressed and never reused, so they can be cached
    # indefinitely.
    response = send_from_directory(storage.directory, key, max_age=31536000, conditional=True)
    # Stops a browser second-guessing the type and executing what it finds.
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Disposition"] = "inline"
    return response
