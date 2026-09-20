"""Team administration. Club Admin only."""

from __future__ import annotations

from flask import Response, jsonify

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import (
    apply_changes,
    commit_or_conflict,
    not_found,
    parse_body,
    parse_uuid,
)
from app.extensions import db
from app.models.club import Club, Team
from app.schemas.admin import TeamCreate, TeamUpdate
from app.schemas.public import serialize_team
from app.security.authorization import require_capability
from app.security.permissions import Capability
from app.utils.errors import ApiError
from app.utils.slugs import unique_slug


@api_v1.post("/admin/teams")
@require_capability(Capability.MANAGE_TEAMS)
def create_team() -> tuple[Response, int]:
    payload = parse_body(TeamCreate)

    club = db.session.query(Club).first()
    if club is None:
        raise ApiError("Club details must be created first.", status_code=409, code="conflict")

    slug = payload.slug or unique_slug(
        payload.name,
        lambda candidate: db.session.query(Team).filter_by(slug=candidate).first() is not None,
    )

    team = Team(
        club_id=club.id,
        name=payload.name,
        short_name=payload.short_name,
        slug=slug,
        category=payload.category,
        gender=payload.gender,
        accent_key=payload.accent_key,
        summary=payload.summary,
        display_order=payload.display_order,
    )
    db.session.add(team)
    commit_or_conflict("A team with that name or slug already exists.")

    return jsonify({"data": serialize_team(team)}), 201


@api_v1.patch("/admin/teams/<team_id>")
@require_capability(Capability.MANAGE_TEAMS)
def update_team(team_id: str) -> tuple[Response, int]:
    team = db.session.get(Team, parse_uuid(team_id, "team id"))
    if team is None:
        not_found("Team not found.")

    apply_changes(team, parse_body(TeamUpdate))
    commit_or_conflict("A team with that name already exists.")

    return jsonify({"data": serialize_team(team)}), 200
