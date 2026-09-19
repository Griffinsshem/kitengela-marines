"""Public read endpoints.

Unauthenticated by design: this is what supporters' browsers and the Next.js
server read. Collections return the {"data", "meta"} envelope; single resources
return {"data"}.

Empty is a valid answer. A club with no fixtures gets an empty list and a 200,
never a 404, so the frontend renders a designed empty state rather than an
error page.
"""

from __future__ import annotations

import uuid
from typing import NoReturn

from flask import Response, jsonify, request
from sqlalchemy import Select, case, select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.extensions import db
from app.models.club import Club, Team
from app.models.competition import Competition, Season
from app.models.enums import FixtureStatus, PlayerPosition, PlayerStatus
from app.models.match import Fixture, LeagueStanding
from app.models.people import Player, StaffMember
from app.schemas.public import (
    serialize_club,
    serialize_fixture,
    serialize_match_detail,
    serialize_player,
    serialize_player_detail,
    serialize_season,
    serialize_staff,
    serialize_standing,
    serialize_team,
)
from app.services.statistics import season_statistics
from app.utils.errors import ApiError
from app.utils.http import cached
from app.utils.pagination import paginate

# Matches not yet played. Cancelled and abandoned appear in neither list but
# remain reachable by slug, so a shared link never dies.
UPCOMING_STATUSES = (FixtureStatus.SCHEDULED, FixtureStatus.POSTPONED)

# Squad listings hide players who have left; their profile URL still resolves
# so old match reports and shared links keep working.
CURRENT_SQUAD_STATUSES = (
    PlayerStatus.ACTIVE,
    PlayerStatus.INJURED,
    PlayerStatus.SUSPENDED,
)

POSITION_ORDER = case(
    (Player.position == PlayerPosition.GOALKEEPER, 1),
    (Player.position == PlayerPosition.DEFENDER, 2),
    (Player.position == PlayerPosition.MIDFIELDER, 3),
    else_=4,
)

POSITION_GROUPS = (
    ("goalkeepers", PlayerPosition.GOALKEEPER),
    ("defenders", PlayerPosition.DEFENDER),
    ("midfielders", PlayerPosition.MIDFIELDER),
    ("forwards", PlayerPosition.FORWARD),
)


def _not_found(message: str) -> NoReturn:
    """Always raises. NoReturn lets mypy narrow the Optional at each call site."""
    raise ApiError(message, status_code=404, code="not_found")


def _team_by_slug(slug: str) -> Team:
    team = db.session.scalars(
        select(Team).where(Team.slug == slug, Team.is_active.is_(True))
    ).first()
    if team is None:
        _not_found("Team not found.")
    return team


def _current_season() -> Season | None:
    return db.session.scalars(
        select(Season).where(Season.is_current.is_(True)).order_by(Season.created_at.desc())
    ).first()


def _season_from_query() -> Season | None:
    slug = request.args.get("season")
    if slug:
        return db.session.scalars(select(Season).where(Season.slug == slug)).first()
    return _current_season()


def _fixture_base() -> Select[tuple[Fixture]]:
    """Eager-load everything a fixture card renders, in three queries not N."""
    return select(Fixture).options(
        selectinload(Fixture.team),
        selectinload(Fixture.opponent),
        selectinload(Fixture.season).selectinload(Season.competition),
    )


def _apply_fixture_filters(stmt: Select[tuple[Fixture]]) -> Select[tuple[Fixture]]:
    team_slug = request.args.get("team")
    if team_slug:
        stmt = stmt.where(Fixture.team_id == _team_by_slug(team_slug).id)

    competition_slug = request.args.get("competition")
    if competition_slug:
        stmt = (
            stmt.join(Season, Season.id == Fixture.season_id)
            .join(Competition, Competition.id == Season.competition_id)
            .where(Competition.slug == competition_slug)
        )

    season_slug = request.args.get("season")
    if season_slug:
        season = db.session.scalars(select(Season).where(Season.slug == season_slug)).first()
        stmt = stmt.where(Fixture.season_id == (season.id if season else uuid.uuid4()))

    return stmt


# --------------------------------------------------------------------------
# Club and teams
# --------------------------------------------------------------------------


@api_v1.get("/club")
def get_club() -> tuple[Response, int]:
    club = db.session.scalars(select(Club).limit(1)).first()
    payload = serialize_club(club) if club is not None else None
    return cached(jsonify({"data": payload}), 300), 200


@api_v1.get("/teams")
def list_teams() -> tuple[Response, int]:
    stmt = select(Team).where(Team.is_active.is_(True)).order_by(Team.display_order, Team.name)
    teams = db.session.scalars(stmt).all()
    return cached(jsonify({"data": [serialize_team(team) for team in teams]}), 300), 200


@api_v1.get("/teams/<slug>")
def get_team(slug: str) -> tuple[Response, int]:
    team = _team_by_slug(slug)

    next_fixture = db.session.scalars(
        _fixture_base()
        .where(Fixture.team_id == team.id, Fixture.status.in_(UPCOMING_STATUSES))
        # Fixtures without a confirmed kickoff sort last rather than first.
        .order_by(Fixture.kickoff_at.is_(None), Fixture.kickoff_at)
        .limit(1)
    ).first()

    latest_result = db.session.scalars(
        _fixture_base()
        .where(Fixture.team_id == team.id, Fixture.status == FixtureStatus.COMPLETED)
        .order_by(Fixture.kickoff_at.desc())
        .limit(1)
    ).first()

    data = serialize_team(team)
    data["next_fixture"] = serialize_fixture(next_fixture) if next_fixture else None
    data["latest_result"] = serialize_fixture(latest_result) if latest_result else None
    return cached(jsonify({"data": data}), 120), 200


# --------------------------------------------------------------------------
# Squad and staff
# --------------------------------------------------------------------------


@api_v1.get("/teams/<slug>/players")
def list_squad(slug: str) -> tuple[Response, int]:
    team = _team_by_slug(slug)

    players = db.session.scalars(
        select(Player)
        .where(Player.team_id == team.id, Player.status.in_(CURRENT_SQUAD_STATUSES))
        .order_by(POSITION_ORDER, Player.squad_number.is_(None), Player.squad_number)
        .options(selectinload(Player.team))
    ).all()

    # Grouped by position because that is how a squad page is read. A squad is
    # tens of rows, so it is not paginated.
    grouped = {
        key: [serialize_player(p) for p in players if p.position == position]
        for key, position in POSITION_GROUPS
    }
    return cached(jsonify({"data": grouped, "meta": {"total": len(players)}}), 300), 200


@api_v1.get("/teams/<team_slug>/players/<player_slug>")
def get_player(team_slug: str, player_slug: str) -> tuple[Response, int]:
    team = _team_by_slug(team_slug)

    player = db.session.scalars(
        select(Player)
        .where(Player.team_id == team.id, Player.slug == player_slug)
        .options(selectinload(Player.team))
    ).first()
    if player is None:
        _not_found("Player not found.")

    season = _current_season()
    statistics = season_statistics(player, season.id if season is not None else None)

    data = serialize_player_detail(player, statistics)
    data["statistics_season"] = season.label if season is not None else None
    return cached(jsonify({"data": data}), 300), 200


@api_v1.get("/staff")
def list_staff() -> tuple[Response, int]:
    stmt = (
        select(StaffMember)
        .where(StaffMember.is_active.is_(True))
        .order_by(StaffMember.display_order, StaffMember.last_name)
        .options(selectinload(StaffMember.team))
    )
    team_slug = request.args.get("team")
    if team_slug:
        stmt = stmt.where(StaffMember.team_id == _team_by_slug(team_slug).id)

    members = db.session.scalars(stmt).all()
    return cached(jsonify({"data": [serialize_staff(m) for m in members]}), 300), 200


# --------------------------------------------------------------------------
# Fixtures, results and match centre
# --------------------------------------------------------------------------


@api_v1.get("/fixtures")
def list_fixtures() -> tuple[Response, int]:
    stmt = _apply_fixture_filters(
        _fixture_base().where(Fixture.status.in_(UPCOMING_STATUSES))
    ).order_by(Fixture.kickoff_at.is_(None), Fixture.kickoff_at)
    return cached(jsonify(paginate(stmt, serialize_fixture)), 60), 200


@api_v1.get("/results")
def list_results() -> tuple[Response, int]:
    # Same table, same row, different filter. Entering a score is what moves a
    # match from the list above into this one.
    stmt = _apply_fixture_filters(
        _fixture_base().where(Fixture.status == FixtureStatus.COMPLETED)
    ).order_by(Fixture.kickoff_at.desc())
    return cached(jsonify(paginate(stmt, serialize_fixture)), 60), 200


@api_v1.get("/matches/<slug>")
def get_match(slug: str) -> tuple[Response, int]:
    fixture = db.session.scalars(
        _fixture_base()
        .where(Fixture.slug == slug)
        .options(
            selectinload(Fixture.events),
            selectinload(Fixture.player_statistics),
            selectinload(Fixture.player_of_the_match),
        )
    ).first()
    if fixture is None:
        _not_found("Match not found.")

    return cached(jsonify({"data": serialize_match_detail(fixture)}), 60), 200


# --------------------------------------------------------------------------
# Competitions and standings
# --------------------------------------------------------------------------


@api_v1.get("/competitions")
def list_competitions() -> tuple[Response, int]:
    seasons = db.session.scalars(
        select(Season)
        .join(Competition, Competition.id == Season.competition_id)
        .where(Competition.is_active.is_(True))
        .order_by(Season.is_current.desc(), Season.label.desc())
        .options(selectinload(Season.competition))
    ).all()
    return cached(jsonify({"data": [serialize_season(s) for s in seasons]}), 300), 200


@api_v1.get("/standings")
def list_standings() -> tuple[Response, int]:
    season = _season_from_query()
    if season is None:
        # No season configured yet. An empty table, not an error.
        return cached(jsonify({"data": [], "meta": {"season": None}}), 60), 200

    standings = db.session.scalars(
        select(LeagueStanding)
        .where(LeagueStanding.season_id == season.id)
        .order_by(LeagueStanding.position)
        .options(selectinload(LeagueStanding.team), selectinload(LeagueStanding.opponent))
    ).all()

    return cached(
        jsonify(
            {
                "data": [serialize_standing(s) for s in standings],
                "meta": {"season": serialize_season(season)},
            }
        ),
        60,
    ), 200
