"""Video administration."""

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
from app.models.media import Video
from app.schemas.admin import VideoCreate, VideoUpdate
from app.schemas.public import serialize_video_admin
from app.security.authorization import require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError
from app.utils.pagination import paginate
from app.utils.slugs import unique_slug
from app.utils.video import parse_youtube_id


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def _load(video_id: str) -> Video:
    video = db.session.get(Video, parse_uuid(video_id, "video id"))
    if video is None:
        not_found("Video not found.")
    return video


def _check_references(values: dict[str, Any]) -> None:
    checks: tuple[tuple[str, type[Any], str], ...] = (
        ("team_id", Team, "Unknown team."),
        ("fixture_id", Fixture, "Unknown fixture."),
    )
    for field, model, message in checks:
        value = values.get(field)
        if value is not None and db.session.get(model, value) is None:
            raise _invalid(field, message)


def _youtube_id(url: str) -> str:
    video_id = parse_youtube_id(url)
    if video_id is None:
        raise _invalid("youtube_url", "That is not a YouTube link.")
    return video_id


@api_v1.get("/admin/videos")
@require_capability(Capability.MANAGE_MEDIA)
def list_videos_admin() -> tuple[Response, int]:
    stmt = select(Video).options(selectinload(Video.team)).order_by(Video.updated_at.desc())
    return jsonify(paginate(stmt, serialize_video_admin)), 200


@api_v1.post("/admin/videos")
@require_capability(Capability.MANAGE_MEDIA)
def create_video() -> tuple[Response, int]:
    payload = parse_body(VideoCreate)
    values = payload.model_dump()
    _check_references(values)

    # The URL is parsed and discarded; only the id is stored.
    values.pop("youtube_url")
    video = Video(
        youtube_id=_youtube_id(payload.youtube_url),
        slug=unique_slug(
            payload.title,
            lambda candidate: db.session.query(Video).filter_by(slug=candidate).first() is not None,
        ),
        **values,
    )
    db.session.add(video)
    commit_or_conflict("A video with that slug already exists.")

    return jsonify({"data": serialize_video_admin(video)}), 201


@api_v1.patch("/admin/videos/<video_id>")
@require_capability(Capability.MANAGE_MEDIA)
def update_video(video_id: str) -> tuple[Response, int]:
    video = _load(video_id)
    changes = parse_body(VideoUpdate).model_dump(exclude_unset=True)
    _check_references(changes)

    if "youtube_url" in changes:
        video.youtube_id = _youtube_id(changes.pop("youtube_url"))

    for field, value in changes.items():
        setattr(video, field, value)
    commit_or_conflict("That change conflicts with an existing video.")

    return jsonify({"data": serialize_video_admin(video)}), 200


@api_v1.delete("/admin/videos/<video_id>")
@require_capability(Capability.MANAGE_MEDIA)
def delete_video(video_id: str) -> tuple[Response, int]:
    video = _load(video_id)
    set_action("video.deleted")

    db.session.delete(video)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200
