"""User account administration.

Accounts are the one thing the club could not manage for itself until now:
adding a Team Manager meant a developer with a terminal. That made the club
dependent on one person for something it should be able to do on a Sunday
evening.

Two rules shape the rest of this file.

Accounts are deactivated, never deleted. The audit log points at users, and
deleting one would rewrite the club's own record of who did what.

Passwords are generated here and shown exactly once. An administrator choosing
a password for somebody else picks a weak one and then knows it; a generated
one is read to the person and never retrievable afterwards, so a new one can
be issued but the current one cannot be looked up.
"""

from __future__ import annotations

import secrets
import uuid
from typing import Any

from flask import Response, jsonify
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import (
    commit_or_conflict,
    not_found,
    parse_body,
    parse_uuid,
)
from app.extensions import db
from app.models.club import Team
from app.models.enums import MembershipCapacity, RoleKey
from app.models.identity import Role, TeamMembership, User
from app.schemas.admin import UserCreate, UserUpdate
from app.security.authorization import current_user, require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError

# No O, 0, I or 1: this password is read aloud down a phone, not copied from
# an email, and those four are the characters people mishear.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# Which roles are meaningless without a team. A coach attached to no team has
# no team-scoped capability and therefore cannot do anything at all.
_TEAM_SCOPED_ROLES: dict[RoleKey, MembershipCapacity] = {
    RoleKey.TEAM_MANAGER: MembershipCapacity.MANAGER,
    RoleKey.COACH: MembershipCapacity.COACH,
}


def _temporary_password() -> str:
    """Four groups of four, which is short enough to read out and long enough
    to be worth having."""
    return "-".join("".join(secrets.choice(_ALPHABET) for _ in range(4)) for _ in range(4))


def _serialize(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "roles": sorted(role.key.value for role in user.roles),
        "teams": sorted(
            {membership.team.short_name for membership in user.memberships if membership.team}
        ),
    }


def _load(user_id: str) -> User:
    user = db.session.scalars(
        select(User)
        .where(User.id == parse_uuid(user_id, "user id"))
        .options(
            selectinload(User.roles),
            selectinload(User.memberships).selectinload(TeamMembership.team),
        )
    ).first()
    if user is None:
        not_found("User not found.")
    return user


def _role_or_refuse(key: RoleKey) -> Role:
    role = db.session.scalars(select(Role).where(Role.key == key)).first()
    if role is None:
        raise ApiError(
            "That role does not exist. Run the role seeding command.",
            status_code=409,
            code="conflict",
        )
    return role


def _teams_for(role_key: RoleKey, team_ids: list[uuid.UUID]) -> list[Team]:
    """Validate the teams before anything is created.

    Separate from applying them so that a bad request never leaves a
    half-built user in the session: everything is checked first, and only then
    is a row constructed.

    Only for roles scoped to a team. A Club Admin or Media Officer works
    across the whole club, so attaching them to one team would imply a limit
    that does not exist.
    """
    capacity = _TEAM_SCOPED_ROLES.get(role_key)
    if capacity is None:
        return []

    if not team_ids:
        raise ApiError(
            "Choose at least one team: this role can only act on teams it belongs to.",
            status_code=422,
            code="validation_error",
            details=[{"field": "team_ids", "message": "At least one team is required."}],
        )

    teams = db.session.scalars(select(Team).where(Team.id.in_(team_ids))).all()
    if len(teams) != len(set(team_ids)):
        raise ApiError(
            "Request validation failed.",
            status_code=422,
            code="validation_error",
            details=[{"field": "team_ids", "message": "Unknown team."}],
        )

    return list(teams)


def _apply_teams(user: User, role_key: RoleKey, teams: list[Team]) -> None:
    capacity = _TEAM_SCOPED_ROLES.get(role_key)
    user.memberships.clear()
    if capacity is None:
        return
    for team in teams:
        user.memberships.append(TeamMembership(team_id=team.id, capacity=capacity))


@api_v1.get("/admin/users")
@require_capability(Capability.MANAGE_USERS)
def list_users() -> tuple[Response, int]:
    users = db.session.scalars(
        select(User)
        .options(
            selectinload(User.roles),
            selectinload(User.memberships).selectinload(TeamMembership.team),
        )
        .order_by(User.full_name)
    ).all()

    return jsonify({"data": [_serialize(user) for user in users]}), 200


@api_v1.post("/admin/users")
@require_capability(Capability.MANAGE_USERS)
def create_user() -> tuple[Response, int]:
    """Create an account and return its one and only temporary password."""
    payload = parse_body(UserCreate)

    existing = db.session.scalars(
        select(User).where(User.email == payload.email.lower().strip())
    ).first()
    if existing is not None:
        raise ApiError(
            "Somebody already has an account with that email address.",
            status_code=409,
            code="conflict",
        )

    # Everything that can be refused is refused before a row exists, so a bad
    # request leaves nothing half-built behind it.
    role = _role_or_refuse(payload.role)
    teams = _teams_for(payload.role, payload.team_ids)

    set_action("user.created")
    password = _temporary_password()

    user = User(email=str(payload.email), full_name=payload.full_name)
    user.set_password(password)
    user.roles.append(role)
    _apply_teams(user, payload.role, teams)
    db.session.add(user)

    commit_or_conflict("That account could not be created.")

    return jsonify(
        {
            "data": _serialize(user),
            # Returned once, here, and never obtainable again. The person who
            # created the account reads it to whoever it belongs to.
            "temporary_password": password,
        }
    ), 201


@api_v1.patch("/admin/users/<user_id>")
@require_capability(Capability.MANAGE_USERS)
def update_user(user_id: str) -> tuple[Response, int]:
    """Change a role, the teams, or whether the account works at all."""
    user = _load(user_id)
    payload = parse_body(UserUpdate)
    values = payload.model_dump(exclude_unset=True)
    actor = current_user()

    # Two guards against locking the club out of its own site. Without them
    # the last administrator can remove their own access, and only somebody
    # with database access could put it back.
    if actor is not None and actor.id == user.id:
        if values.get("is_active") is False:
            raise ApiError(
                "You cannot deactivate your own account.",
                status_code=409,
                code="conflict",
            )
        if "role" in values and values["role"] != RoleKey.CLUB_ADMIN and user.is_club_admin:
            raise ApiError(
                "You cannot remove your own Club Admin role.",
                status_code=409,
                code="conflict",
            )

    set_action("user.updated")

    if "full_name" in values:
        user.full_name = values["full_name"]
    if "is_active" in values:
        user.is_active = values["is_active"]

    # A user always has exactly one role, but the type system cannot know
    # that, and a user somehow without one should be refused rather than
    # silently treated as club-wide.
    role_now: RoleKey | None = values.get("role") or next(iter(user.role_keys), None)
    if role_now is None:
        raise ApiError(
            "That account has no role. Give it one before changing its teams.",
            status_code=409,
            code="conflict",
        )

    if "team_ids" in values or "role" in values:
        teams = _teams_for(role_now, values.get("team_ids", []))
        if "role" in values:
            role = _role_or_refuse(values["role"])
            user.roles.clear()
            user.roles.append(role)
        _apply_teams(user, role_now, teams)
    elif "role" in values:
        user.roles.clear()
        user.roles.append(_role_or_refuse(values["role"]))

    commit_or_conflict("That account could not be saved.")
    return jsonify({"data": _serialize(user)}), 200


@api_v1.post("/admin/users/<user_id>/password")
@require_capability(Capability.MANAGE_USERS)
def reset_user_password(user_id: str) -> tuple[Response, int]:
    """Issue a new temporary password, shown once."""
    user = _load(user_id)
    set_action("user.password_reset")

    password = _temporary_password()
    user.set_password(password)
    commit_or_conflict("That password could not be reset.")

    return jsonify({"data": _serialize(user), "temporary_password": password}), 200
