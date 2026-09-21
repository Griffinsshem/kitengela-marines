"""Player administration.

Two independent checks on every route: the capability decorator asks whether
the role may manage a squad at all, then require_team_scope asks whether it may
manage *this* squad. The second cannot be a decorator, because the target team
comes from the request body or the stored record.
"""

from __future__ import annotations

import uuid

from flask import Response, jsonify
from sqlalchemy import select
from sqlalchemy.orm import selectinload

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
from app.models.people import Player
from app.schemas.admin import PlayerCreate, PlayerSelfUpdate, PlayerTransfer, PlayerUpdate
from app.schemas.public import serialize_player_admin
from app.security.authorization import (
    authenticated,
    current_user,
    require_capability,
    require_team_scope,
)
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError
from app.utils.slugs import unique_slug


def _load_player(player_id: str) -> Player:
    player = db.session.get(Player, parse_uuid(player_id, "player id"))
    if player is None:
        not_found("Player not found.")
    return player


def _load_team(team_id: uuid.UUID) -> Team:
    team = db.session.get(Team, team_id)
    if team is None:
        raise ApiError(
            "Request validation failed.",
            status_code=422,
            code="validation_error",
            details=[{"field": "team_id", "message": "Unknown team."}],
        )
    return team


@api_v1.get("/admin/teams/<team_id>/players")
@require_capability(Capability.VIEW_PRIVATE_PLAYER_DATA)
def list_squad_admin(team_id: str) -> tuple[Response, int]:
    team = _load_team(parse_uuid(team_id, "team id"))
    require_team_scope(current_user(), Capability.VIEW_PRIVATE_PLAYER_DATA, team.id)

    players = db.session.scalars(
        select(Player)
        .where(Player.team_id == team.id)
        .order_by(Player.last_name, Player.first_name)
        .options(selectinload(Player.team))
    ).all()

    return jsonify({"data": [serialize_player_admin(p) for p in players]}), 200


@api_v1.post("/admin/players")
@require_capability(Capability.MANAGE_SQUAD)
def create_player() -> tuple[Response, int]:
    payload = parse_body(PlayerCreate)
    team = _load_team(payload.team_id)
    # Scope is checked against the team named in the body, not a URL segment.
    require_team_scope(current_user(), Capability.MANAGE_SQUAD, team.id)

    name = payload.known_as or f"{payload.first_name} {payload.last_name}"
    slug = unique_slug(
        name,
        lambda candidate: (
            db.session.query(Player).filter_by(team_id=team.id, slug=candidate).first() is not None
        ),
    )

    player = Player(slug=slug, **payload.model_dump())
    db.session.add(player)
    commit_or_conflict("A player with that name already exists in this squad.")

    return jsonify({"data": serialize_player_admin(player)}), 201


@api_v1.patch("/admin/players/<player_id>")
@require_capability(Capability.MANAGE_SQUAD)
def update_player(player_id: str) -> tuple[Response, int]:
    player = _load_player(player_id)
    require_team_scope(current_user(), Capability.MANAGE_SQUAD, player.team_id)

    apply_changes(player, parse_body(PlayerUpdate))
    commit_or_conflict("That change conflicts with an existing player.")

    return jsonify({"data": serialize_player_admin(player)}), 200


@api_v1.post("/admin/players/<player_id>/transfer")
@require_capability(Capability.MANAGE_SQUAD)
def transfer_player(player_id: str) -> tuple[Response, int]:
    """Move a player between squads.

    Its own endpoint rather than a field on PlayerUpdate, because it needs
    scope on both the current and the destination team. A Starlets coach must
    not be able to move a player into the men's squad, or out of it.
    """
    player = _load_player(player_id)
    payload = parse_body(PlayerTransfer)
    set_action("player.transferred")
    destination = _load_team(payload.team_id)

    user = current_user()
    require_team_scope(user, Capability.MANAGE_SQUAD, player.team_id)
    require_team_scope(user, Capability.MANAGE_SQUAD, destination.id)

    player.team_id = destination.id
    commit_or_conflict("A player with that name already exists in the destination squad.")

    return jsonify({"data": serialize_player_admin(player)}), 200


@api_v1.get("/admin/players/me")
@authenticated
def get_own_profile() -> tuple[Response, int]:
    user = current_user()
    if user.player_profile is None:
        not_found("No player profile is linked to this account.")
    return jsonify({"data": serialize_player_admin(user.player_profile)}), 200


@api_v1.patch("/admin/players/me")
@authenticated
def update_own_profile() -> tuple[Response, int]:
    """A player edits their own profile.

    Separate endpoint and separate schema from the admin update, so there is no
    path by which a player-authored request reaches the code that can change a
    position, a squad number or a team.
    """
    user = current_user()
    profile = user.player_profile
    if profile is None:
        not_found("No player profile is linked to this account.")

    apply_changes(profile, parse_body(PlayerSelfUpdate))
    db.session.commit()

    return jsonify({"data": serialize_player_admin(profile)}), 200


@api_v1.delete("/admin/players/<player_id>")
@require_capability(Capability.MANAGE_USERS)
def delete_player(player_id: str) -> tuple[Response, int]:
    """Club Admin only, and only for a player with no match record.

    A player who has appeared in a match is never deleted: the statistics and
    match events reference them, and removing the row would silently rewrite
    the club's history. Mark them FORMER instead.
    """
    player = _load_player(player_id)
    set_action("player.deleted")

    if player.statistics_count > 0:
        raise ApiError(
            "This player has match records. Set their status to 'former' instead.",
            status_code=409,
            code="conflict",
        )

    db.session.delete(player)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200
