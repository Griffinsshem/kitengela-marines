"""Media uploads.

Uploads go through the API, not straight from the browser to Cloudinary, so
the storage credentials stay on the server and every file passes through
validation before it is stored anywhere.
"""

from __future__ import annotations

import logging
import uuid

from flask import Response, jsonify, request
from sqlalchemy import select

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import not_found, parse_uuid
from app.extensions import db, limiter
from app.models.media import Gallery, GalleryItem, MediaAsset
from app.models.news import Article
from app.models.outreach import Sponsor
from app.schemas.public import serialize_media_asset_admin
from app.security.authorization import current_user, require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.services.images import ImageRejectedError, process_image
from app.storage import get_storage
from app.utils.errors import ApiError
from app.utils.pagination import paginate

logger = logging.getLogger(__name__)

MAX_ALT_TEXT = 250
MAX_CAPTION = 500


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def _load(asset_id: str) -> MediaAsset:
    asset = db.session.get(MediaAsset, parse_uuid(asset_id, "asset id"))
    if asset is None:
        not_found("Media asset not found.")
    return asset


@api_v1.post("/admin/media/uploads")
@limiter.limit("60 per hour")
@require_capability(Capability.MANAGE_MEDIA)
def upload_media() -> tuple[Response, int]:
    upload = request.files.get("file")
    if upload is None:
        raise ApiError("A file is required.", status_code=400)

    alt_text = (request.form.get("alt_text") or "").strip()
    if not alt_text or len(alt_text) > MAX_ALT_TEXT:
        raise _invalid("alt_text", f"Alt text is required, up to {MAX_ALT_TEXT} characters.")

    caption = (request.form.get("caption") or "").strip() or None
    if caption is not None and len(caption) > MAX_CAPTION:
        raise _invalid("caption", f"A caption may be up to {MAX_CAPTION} characters.")

    try:
        processed = process_image(upload.read())
    except ImageRejectedError as error:
        raise _invalid("file", str(error)) from error

    # The uploaded filename is never used: not for the key, not for the type,
    # not anywhere. It is attacker-controlled and tells us nothing the file's
    # own bytes have not already told us.
    key = f"{uuid.uuid4().hex}.{processed.extension}"
    stored = get_storage().save(processed.data, key=key, content_type=processed.content_type)

    asset = MediaAsset(
        storage_key=stored.key,
        url=stored.url,
        content_type=processed.content_type,
        width=processed.width,
        height=processed.height,
        byte_size=processed.byte_size,
        alt_text=alt_text,
        caption=caption,
        uploaded_by_id=current_user().id,
    )
    set_action("media.uploaded")
    db.session.add(asset)
    db.session.commit()

    return jsonify({"data": serialize_media_asset_admin(asset)}), 201


@api_v1.get("/admin/media/assets")
@require_capability(Capability.MANAGE_MEDIA)
def list_media_assets() -> tuple[Response, int]:
    stmt = select(MediaAsset).order_by(MediaAsset.created_at.desc())
    return jsonify(paginate(stmt, serialize_media_asset_admin)), 200


@api_v1.patch("/admin/media/assets/<asset_id>")
@require_capability(Capability.MANAGE_MEDIA)
def update_media_asset(asset_id: str) -> tuple[Response, int]:
    """Alt text and caption only. The file itself is immutable: correcting a
    photo means uploading the corrected one, so a URL never changes meaning."""
    asset = _load(asset_id)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("A JSON object body is required.", status_code=400)

    unknown = set(body) - {"alt_text", "caption"}
    if unknown:
        raise _invalid(sorted(unknown)[0], "Unknown field.")

    if "alt_text" in body:
        alt_text = str(body["alt_text"] or "").strip()
        if not alt_text or len(alt_text) > MAX_ALT_TEXT:
            raise _invalid("alt_text", f"Alt text is required, up to {MAX_ALT_TEXT} characters.")
        asset.alt_text = alt_text

    if "caption" in body:
        caption = str(body["caption"] or "").strip() or None
        if caption is not None and len(caption) > MAX_CAPTION:
            raise _invalid("caption", f"A caption may be up to {MAX_CAPTION} characters.")
        asset.caption = caption

    db.session.commit()
    return jsonify({"data": serialize_media_asset_admin(asset)}), 200


@api_v1.delete("/admin/media/assets/<asset_id>")
@require_capability(Capability.MANAGE_MEDIA)
def delete_media_asset(asset_id: str) -> tuple[Response, int]:
    """Removes the stored file and the record.

    Nothing references assets yet. When galleries and article images land, this
    gains an in-use check so deleting a photo cannot blank a published page.
    """
    asset = _load(asset_id)

    # Deleting a photo a published page depends on would silently blank it.
    uses: list[str] = []
    if db.session.query(GalleryItem).filter_by(asset_id=asset.id).first() is not None:
        uses.append("a gallery")
    if db.session.query(Gallery).filter_by(cover_asset_id=asset.id).first() is not None:
        uses.append("a gallery cover")
    if db.session.query(Article).filter_by(featured_image_id=asset.id).first() is not None:
        uses.append("an article")
    if db.session.query(Sponsor).filter_by(logo_asset_id=asset.id).first() is not None:
        uses.append("a sponsor logo")
    if uses:
        raise ApiError(
            f"This photo is used by {' and '.join(uses)}. Remove it there first.",
            status_code=409,
            code="conflict",
        )

    set_action("media.deleted")
    set_action("media.deleted")

    try:
        get_storage().delete(asset.storage_key)
    except Exception as error:  # noqa: BLE001 — a stranded file must not block the record
        logger.error("could not delete stored file %s", asset.storage_key, exc_info=error)

    db.session.delete(asset)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200
