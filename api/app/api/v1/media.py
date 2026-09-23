"""Public galleries and video."""

from __future__ import annotations

from flask import Response, jsonify, request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.extensions import db
from app.models.club import Team
from app.models.media import Gallery, GalleryItem, Video
from app.schemas.public import serialize_gallery, serialize_gallery_summary, serialize_video
from app.utils.errors import ApiError
from app.utils.http import cached
from app.utils.pagination import paginate


@api_v1.get("/galleries")
def list_galleries() -> tuple[Response, int]:
    stmt = (
        select(Gallery)
        .where(Gallery.is_published.is_(True))
        .options(
            selectinload(Gallery.cover_asset),
            selectinload(Gallery.team),
            # Loaded for the cover fallback and the photo count, in one extra
            # query rather than one per gallery.
            selectinload(Gallery.items).selectinload(GalleryItem.asset),
        )
        .order_by(Gallery.event_date.desc().nullslast(), Gallery.created_at.desc())
    )

    team = request.args.get("team")
    if team:
        stmt = stmt.join(Team, Team.id == Gallery.team_id).where(Team.slug == team)

    return cached(jsonify(paginate(stmt, serialize_gallery_summary)), 300), 200


@api_v1.get("/galleries/<slug>")
def get_gallery(slug: str) -> tuple[Response, int]:
    gallery = db.session.scalars(
        select(Gallery)
        .where(Gallery.slug == slug, Gallery.is_published.is_(True))
        .options(
            selectinload(Gallery.cover_asset),
            selectinload(Gallery.team),
            selectinload(Gallery.fixture),
            selectinload(Gallery.items).selectinload(GalleryItem.asset),
        )
    ).first()
    if gallery is None:
        raise ApiError("Gallery not found.", status_code=404, code="not_found")

    return cached(jsonify({"data": serialize_gallery(gallery)}), 300), 200


@api_v1.get("/videos")
def list_videos() -> tuple[Response, int]:
    stmt = (
        select(Video)
        .where(Video.is_published.is_(True))
        .options(selectinload(Video.team))
        .order_by(Video.published_on.desc().nullslast(), Video.created_at.desc())
    )

    team = request.args.get("team")
    if team:
        stmt = stmt.join(Team, Team.id == Video.team_id).where(Team.slug == team)

    return cached(jsonify(paginate(stmt, serialize_video)), 300), 200
