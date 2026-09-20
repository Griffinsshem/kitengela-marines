"""Fixture, result and standings administration."""

from __future__ import annotations

from flask import Response, jsonify
from sqlalchemy import select

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
from app.models.competition import Competition, Opponent, Season
from app.models.enums import FixtureStatus
from app.models.match import Fixture, LeagueStanding
from app.schemas.admin import (
    CompetitionCreate,
    FixtureCreate,
    FixtureUpdate,
    OpponentCreate,
    ResultInput,
    SeasonCreate,
    StandingsReplace,
)
from app.schemas.public import serialize_fixture, serialize_match_detail, serialize_standing
from app.security.authorization import current_user, require_capability, require_team_scope
from app.security.permissions import Capability
from app.services.results import record_result
from app.utils.errors import ApiError
from app.utils.slugs import unique_slug


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def _load_fixture(fixture_id: str) -> Fixture:
    fixture = db.session.get(Fixture, parse_uuid(fixture_id, "fixture id"))
    if fixture is None:
        not_found("Fixture not found.")
    return fixture


def _fixture_slug(team: Team, opponent: Opponent) -> str:
    return unique_slug(
        f"{team.short_name} v {opponent.short_name}",
        lambda candidate: db.session.query(Fixture).filter_by(slug=candidate).first() is not None,
    )


# --- Competitions, seasons, opponents --------------------------------------


@api_v1.post("/admin/competitions")
@require_capability(Capability.MANAGE_CLUB)
def create_competition() -> tuple[Response, int]:
    payload = parse_body(CompetitionCreate)

    competition = Competition(
        name=payload.name,
        short_name=payload.short_name,
        has_standings=payload.has_standings,
        slug=unique_slug(
            payload.name,
            lambda c: db.session.query(Competition).filter_by(slug=c).first() is not None,
        ),
    )
    db.session.add(competition)
    commit_or_conflict("That competition already exists.")

    return jsonify({"data": {"id": str(competition.id), "slug": competition.slug}}), 201


@api_v1.post("/admin/seasons")
@require_capability(Capability.MANAGE_CLUB)
def create_season() -> tuple[Response, int]:
    payload = parse_body(SeasonCreate)

    competition = db.session.get(Competition, payload.competition_id)
    if competition is None:
        raise _invalid("competition_id", "Unknown competition.")

    season = Season(
        competition_id=competition.id,
        label=payload.label,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        is_current=payload.is_current,
        slug=unique_slug(
            f"{competition.short_name} {payload.label}",
            lambda c: db.session.query(Season).filter_by(slug=c).first() is not None,
        ),
    )

    # Exactly one season per competition is current, so setting a new one
    # clears the previous automatically rather than leaving two.
    if payload.is_current:
        db.session.query(Season).filter(
            Season.competition_id == competition.id, Season.is_current.is_(True)
        ).update({"is_current": False})

    db.session.add(season)
    commit_or_conflict("That season already exists for this competition.")

    return jsonify({"data": {"id": str(season.id), "slug": season.slug}}), 201


@api_v1.post("/admin/opponents")
@require_capability(Capability.MANAGE_FIXTURES)
def create_opponent() -> tuple[Response, int]:
    payload = parse_body(OpponentCreate)

    opponent = Opponent(
        name=payload.name,
        short_name=payload.short_name or payload.name,
        crest_url=payload.crest_url,
        home_ground=payload.home_ground,
        slug=unique_slug(
            payload.name,
            lambda c: db.session.query(Opponent).filter_by(slug=c).first() is not None,
        ),
    )
    db.session.add(opponent)
    commit_or_conflict("An opponent with that name already exists.")

    return jsonify({"data": {"id": str(opponent.id), "slug": opponent.slug}}), 201


@api_v1.get("/admin/opponents")
@require_capability(Capability.MANAGE_FIXTURES)
def list_opponents() -> tuple[Response, int]:
    opponents = db.session.scalars(select(Opponent).order_by(Opponent.name)).all()
    return jsonify(
        {
            "data": [
                {"id": str(o.id), "name": o.name, "short_name": o.short_name, "slug": o.slug}
                for o in opponents
            ]
        }
    ), 200


# --- Fixtures --------------------------------------------------------------


@api_v1.post("/admin/fixtures")
@require_capability(Capability.MANAGE_FIXTURES)
def create_fixture() -> tuple[Response, int]:
    payload = parse_body(FixtureCreate)

    team = db.session.get(Team, payload.team_id)
    if team is None:
        raise _invalid("team_id", "Unknown team.")
    require_team_scope(current_user(), Capability.MANAGE_FIXTURES, team.id)

    opponent = db.session.get(Opponent, payload.opponent_id)
    if opponent is None:
        raise _invalid("opponent_id", "Unknown opponent.")

    if db.session.get(Season, payload.season_id) is None:
        raise _invalid("season_id", "Unknown season.")

    fixture = Fixture(
        team_id=team.id,
        opponent_id=opponent.id,
        season_id=payload.season_id,
        venue=payload.venue,
        venue_name=payload.venue_name,
        kickoff_at=payload.kickoff_at,
        scheduled_on=payload.scheduled_on,
        slug=_fixture_slug(team, opponent),
    )
    db.session.add(fixture)
    commit_or_conflict("That fixture already exists.")

    return jsonify({"data": serialize_fixture(fixture)}), 201


@api_v1.patch("/admin/fixtures/<fixture_id>")
@require_capability(Capability.MANAGE_FIXTURES)
def update_fixture(fixture_id: str) -> tuple[Response, int]:
    fixture = _load_fixture(fixture_id)
    require_team_scope(current_user(), Capability.MANAGE_FIXTURES, fixture.team_id)

    payload = parse_body(FixtureUpdate)
    if payload.opponent_id is not None and db.session.get(Opponent, payload.opponent_id) is None:
        raise _invalid("opponent_id", "Unknown opponent.")

    apply_changes(fixture, payload)
    commit_or_conflict("That change conflicts with an existing fixture.")

    return jsonify({"data": serialize_fixture(fixture)}), 200


@api_v1.put("/admin/fixtures/<fixture_id>/result")
@require_capability(Capability.MANAGE_RESULTS)
def enter_result(fixture_id: str) -> tuple[Response, int]:
    """Record a completed match.

    PUT, not PATCH: the result is submitted whole, and re-submitting replaces
    it. This is the only write that moves a fixture into the results list, and
    it needs no second entry anywhere.
    """
    fixture = _load_fixture(fixture_id)
    require_team_scope(current_user(), Capability.MANAGE_RESULTS, fixture.team_id)

    if fixture.status in (FixtureStatus.CANCELLED, FixtureStatus.ABANDONED):
        raise ApiError(
            "A cancelled or abandoned match cannot carry a result.",
            status_code=409,
            code="conflict",
        )

    record_result(fixture, parse_body(ResultInput))
    db.session.refresh(fixture)

    return jsonify({"data": serialize_match_detail(fixture)}), 200


@api_v1.delete("/admin/fixtures/<fixture_id>")
@require_capability(Capability.MANAGE_USERS)
def delete_fixture(fixture_id: str) -> tuple[Response, int]:
    """Club Admin only, and only before a result exists.

    A played match is part of the club's record; cancelling it is a status
    change, not a deletion.
    """
    fixture = _load_fixture(fixture_id)

    if fixture.status == FixtureStatus.COMPLETED:
        raise ApiError(
            "A completed match cannot be deleted. Change its status instead.",
            status_code=409,
            code="conflict",
        )

    db.session.delete(fixture)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200


# --- Standings -------------------------------------------------------------


@api_v1.put("/admin/standings")
@require_capability(Capability.MANAGE_STANDINGS)
def replace_standings() -> tuple[Response, int]:
    """Replace a season's league table in one transaction.

    The county league publishes no data feed, so the table is typed by hand.
    The schema checks the arithmetic — played equals won plus drawn plus lost,
    positions run 1..n without gaps, no club listed twice — because a table
    that does not add up is worse than no table at all.
    """
    payload = parse_body(StandingsReplace)

    season = db.session.get(Season, payload.season_id)
    if season is None:
        raise _invalid("season_id", "Unknown season.")

    known_teams = {team_id for (team_id,) in db.session.query(Team.id)}
    known_opponents = {opp_id for (opp_id,) in db.session.query(Opponent.id)}

    for index, row in enumerate(payload.rows):
        if row.team_id is not None and row.team_id not in known_teams:
            raise _invalid(f"rows.{index}.team_id", "Unknown team.")
        if row.opponent_id is not None and row.opponent_id not in known_opponents:
            raise _invalid(f"rows.{index}.opponent_id", "Unknown opponent.")

    db.session.query(LeagueStanding).filter_by(season_id=season.id).delete()
    for row in payload.rows:
        db.session.add(LeagueStanding(season_id=season.id, **row.model_dump()))
    db.session.commit()

    standings = db.session.scalars(
        select(LeagueStanding)
        .where(LeagueStanding.season_id == season.id)
        .order_by(LeagueStanding.position)
    ).all()

    return jsonify({"data": [serialize_standing(s) for s in standings]}), 200
