"""Recording a completed match.

One transaction. Score, status, events and line-up are written together or not
at all, so the public fixtures and results endpoints never observe a match
mid-entry.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.extensions import db
from app.models.enums import FixtureStatus, PlayerPosition
from app.models.match import Fixture, MatchEvent, PlayerMatchStatistic
from app.models.people import Player
from app.schemas.admin import ResultInput
from app.utils.errors import ApiError


def _validation_error(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def _squad_player_ids(fixture: Fixture) -> set[uuid.UUID]:
    stmt = select(Player.id).where(Player.team_id == fixture.team_id)
    return set(db.session.scalars(stmt).all())


def record_result(fixture: Fixture, payload: ResultInput) -> Fixture:
    """Apply a result to a fixture.

    Raises before any write if the payload references players from another
    squad, so a partially valid result never lands.
    """
    squad = _squad_player_ids(fixture)

    referenced: set[uuid.UUID] = set()
    for event in payload.events or []:
        referenced.update(
            pid for pid in (event.player_id, event.related_player_id) if pid is not None
        )
    for entry in payload.lineup or []:
        referenced.add(entry.player_id)
    if payload.player_of_the_match_id is not None:
        referenced.add(payload.player_of_the_match_id)

    # Every player named must belong to the team that played the match.
    outsiders = referenced - squad
    if outsiders:
        raise _validation_error("lineup", "One or more players are not in this squad.")

    fixture.our_score = payload.our_score
    fixture.their_score = payload.their_score
    fixture.status = FixtureStatus.COMPLETED
    if payload.report is not None:
        fixture.report = payload.report
    fixture.player_of_the_match_id = payload.player_of_the_match_id

    # Replace rather than merge: "who started" and "what happened" each have one
    # answer, and merging would make removing a mistaken entry impossible.
    if payload.events is not None:
        db.session.query(MatchEvent).filter_by(fixture_id=fixture.id).delete()
        for event in payload.events:
            db.session.add(MatchEvent(fixture_id=fixture.id, **event.model_dump()))

    if payload.lineup is not None:
        db.session.query(PlayerMatchStatistic).filter_by(fixture_id=fixture.id).delete()
        positions: dict[uuid.UUID, PlayerPosition] = {
            player_id: position
            for player_id, position in db.session.execute(
                select(Player.id, Player.position).where(Player.id.in_(squad))
            )
        }
        for entry in payload.lineup:
            values = entry.model_dump()
            # Goalkeeping numbers are dropped for outfield players rather than
            # stored as zeros, which would read as "kept no clean sheet".
            if positions.get(entry.player_id) != PlayerPosition.GOALKEEPER:
                values["clean_sheet"] = None
                values["goals_conceded"] = None
                values["saves"] = None
            db.session.add(PlayerMatchStatistic(fixture_id=fixture.id, **values))

    db.session.commit()
    return fixture
