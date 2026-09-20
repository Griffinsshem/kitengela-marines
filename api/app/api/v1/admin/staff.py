"""Technical and club staff administration."""

from __future__ import annotations

import uuid

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
from app.models.club import Team
from app.models.people import StaffMember
from app.schemas.admin import StaffCreate, StaffUpdate
from app.schemas.public import serialize_staff_admin
from app.security.authorization import current_user, require_capability, require_team_scope
from app.security.permissions import Capability
from app.utils.errors import ApiError
from app.utils.slugs import unique_slug


def _require_scope_for(team_id: uuid.UUID | None) -> None:
    """Team staff need scope on that team; club-wide staff need MANAGE_STAFF.

    A team_id of None means a club official, which only a Club Admin reaches —
    require_team_scope returns True for a capability with no team, so the
    guard here is the explicit club-admin test.
    """
    user = current_user()
    if team_id is None:
        if not user.is_club_admin:
            raise ApiError(
                "Only a club administrator can manage club-wide staff.",
                status_code=403,
                code="forbidden",
            )
        return
    require_team_scope(user, Capability.MANAGE_STAFF, team_id)


@api_v1.post("/admin/staff")
@require_capability(Capability.MANAGE_STAFF)
def create_staff() -> tuple[Response, int]:
    payload = parse_body(StaffCreate)

    if payload.team_id is not None and db.session.get(Team, payload.team_id) is None:
        raise ApiError(
            "Request validation failed.",
            status_code=422,
            code="validation_error",
            details=[{"field": "team_id", "message": "Unknown team."}],
        )

    _require_scope_for(payload.team_id)

    slug = unique_slug(
        f"{payload.first_name} {payload.last_name}",
        lambda candidate: (
            db.session.query(StaffMember).filter_by(slug=candidate).first() is not None
        ),
    )

    member = StaffMember(slug=slug, **payload.model_dump())
    db.session.add(member)
    commit_or_conflict("A staff member with that name already exists.")

    return jsonify({"data": serialize_staff_admin(member)}), 201


@api_v1.patch("/admin/staff/<staff_id>")
@require_capability(Capability.MANAGE_STAFF)
def update_staff(staff_id: str) -> tuple[Response, int]:
    member = db.session.get(StaffMember, parse_uuid(staff_id, "staff id"))
    if member is None:
        not_found("Staff member not found.")

    _require_scope_for(member.team_id)

    apply_changes(member, parse_body(StaffUpdate))
    commit_or_conflict("That change conflicts with an existing staff member.")

    return jsonify({"data": serialize_staff_admin(member)}), 200
