"""Gallery administration."""

from __future__ import annotations

from typing import Any

from flask import Response, jsonify
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import commit_or_conflict, not_found, parse_body, parse_uuid
from app.extensions import db
from app.models.club import Team
from app.models.match import Fixture
from app.models.media import Gallery, GalleryItem, MediaAsset
from app.schemas.admin import GalleryCreate, GalleryPhotosReplace, GalleryUpdate
from app.schemas.public import serialize_gallery_admin
from app.security.authorization import require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError
from app.utils.pagination import paginate
from app.utils.slugs import unique_slug

LOADERS = (
    selectinload(Gallery.cover_asset),
    selectinload(Gallery.team),
    selectinload(Gallery.fixture),
    selectinload(Gallery.items).selectinload(GalleryItem.asset),
)


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def _load(gallery_id: str) -> Gallery:
    gallery = db.session.get(Gallery, parse_uuid(gallery_id, "gallery id"))
    if gallery is None:
        not_found("Gallery not found.")
    return gallery


def _check_references(values: dict[str, Any]) -> None:
    checks: tuple[tuple[str, type[Any], str], ...] = (
        ("team_id", Team, "Unknown team."),
        ("fixture_id", Fixture, "Unknown fixture."),
        ("cover_asset_id", MediaAsset, "Unknown media asset."),
    )
    for field, model, message in checks:
        value = values.get(field)
        if value is not None and db.session.get(model, value) is None:
            raise _invalid(field, message)


@api_v1.get("/admin/galleries")
@require_capability(Capability.MANAGE_MEDIA)
def list_galleries_admin() -> tuple[Response, int]:
    stmt = select(Gallery).options(*LOADERS).order_by(Gallery.updated_at.desc())
    return jsonify(paginate(stmt, serialize_gallery_admin)), 200


@api_v1.get("/admin/galleries/<gallery_id>")
@require_capability(Capability.MANAGE_MEDIA)
def get_gallery_admin(gallery_id: str) -> tuple[Response, int]:
    gallery = db.session.scalars(
        select(Gallery).where(Gallery.id == parse_uuid(gallery_id, "gallery id")).options(*LOADERS)
    ).first()
    if gallery is None:
        not_found("Gallery not found.")
    return jsonify({"data": serialize_gallery_admin(gallery)}), 200


@api_v1.post("/admin/galleries")
@require_capability(Capability.MANAGE_MEDIA)
def create_gallery() -> tuple[Response, int]:
    payload = parse_body(GalleryCreate)
    values = payload.model_dump()
    _check_references(values)

    gallery = Gallery(
        slug=unique_slug(
            payload.title,
            lambda candidate: (
                db.session.query(Gallery).filter_by(slug=candidate).first() is not None
            ),
        ),
        **values,
    )
    db.session.add(gallery)
    commit_or_conflict("A gallery with that slug already exists.")

    return jsonify({"data": serialize_gallery_admin(gallery)}), 201


@api_v1.patch("/admin/galleries/<gallery_id>")
@require_capability(Capability.MANAGE_MEDIA)
def update_gallery(gallery_id: str) -> tuple[Response, int]:
    gallery = _load(gallery_id)
    changes = parse_body(GalleryUpdate).model_dump(exclude_unset=True)
    _check_references(changes)

    for field, value in changes.items():
        setattr(gallery, field, value)
    commit_or_conflict("That change conflicts with an existing gallery.")

    return jsonify({"data": serialize_gallery_admin(gallery)}), 200


@api_v1.put("/admin/galleries/<gallery_id>/photos")
@require_capability(Capability.MANAGE_MEDIA)
def replace_gallery_photos(gallery_id: str) -> tuple[Response, int]:
    """The gallery's photos and their order, in one request."""
    gallery = _load(gallery_id)
    payload = parse_body(GalleryPhotosReplace)

    asset_ids = [photo.asset_id for photo in payload.photos]
    if asset_ids:
        known = set(
            db.session.scalars(select(MediaAsset.id).where(MediaAsset.id.in_(asset_ids))).all()
        )
        if any(asset_id not in known for asset_id in asset_ids):
            raise _invalid("photos", "One or more photos do not exist.")

    db.session.query(GalleryItem).filter_by(gallery_id=gallery.id).delete()
    for position, photo in enumerate(payload.photos):
        db.session.add(
            GalleryItem(
                gallery_id=gallery.id,
                asset_id=photo.asset_id,
                position=position,
                caption=photo.caption,
            )
        )

    set_action("gallery.photos_replaced")
    db.session.commit()
    db.session.refresh(gallery)

    return jsonify({"data": serialize_gallery_admin(gallery)}), 200


@api_v1.delete("/admin/galleries/<gallery_id>")
@require_capability(Capability.MANAGE_MEDIA)
def delete_gallery(gallery_id: str) -> tuple[Response, int]:
    """Removes the gallery and its ordering. The photographs themselves stay
    in the media library, since they may be used elsewhere."""
    gallery = _load(gallery_id)
    set_action("gallery.deleted")

    db.session.delete(gallery)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200
