"""Object factories for tests.

The model test modules predate this and build their own helpers; new tests use
these so squad and fixture setup is written once.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.extensions import db
from app.models import (
    Club,
    Competition,
    Fixture,
    FixtureStatus,
    Opponent,
    Player,
    PlayerPosition,
    Season,
    StaffMember,
    StaffRole,
    Team,
    TeamCategory,
    TeamGender,
    Venue,
)


def club(**kwargs: Any) -> Club:
    existing = db.session.query(Club).first()
    if existing is not None:
        return existing
    record = Club(
        name=kwargs.pop("name", "Kitengela Marines"),
        short_name=kwargs.pop("short_name", "Marines"),
        slug=kwargs.pop("slug", "kitengela-marines"),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record


def team(slug: str = "marines-men", **kwargs: Any) -> Team:
    record = Team(
        club_id=club().id,
        name=kwargs.pop("name", slug.replace("-", " ").title()),
        short_name=kwargs.pop("short_name", "Marines"),
        slug=slug,
        category=kwargs.pop("category", TeamCategory.SENIOR),
        gender=kwargs.pop("gender", TeamGender.MEN),
        accent_key=kwargs.pop("accent_key", slug),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record


def opponent(name: str = "Rivals FC", **kwargs: Any) -> Opponent:
    record = Opponent(
        name=name,
        short_name=kwargs.pop("short_name", name),
        slug=kwargs.pop("slug", name.lower().replace(" ", "-")),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record


def season(**kwargs: Any) -> Season:
    competition = Competition(
        name="Kajiado County League",
        short_name="County League",
        slug="kajiado-county-league",
    )
    db.session.add(competition)
    db.session.flush()
    record = Season(
        competition_id=competition.id,
        label=kwargs.pop("label", "2026/27"),
        slug=kwargs.pop("slug", "kajiado-county-league-2026-27"),
        is_current=kwargs.pop("is_current", True),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record


def player(team_record: Team, first: str = "Test", last: str = "Player", **kwargs: Any) -> Player:
    record = Player(
        team_id=team_record.id,
        first_name=first,
        last_name=last,
        slug=kwargs.pop("slug", f"{first}-{last}".lower()),
        position=kwargs.pop("position", PlayerPosition.MIDFIELDER),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record


def staff(team_record: Team | None = None, **kwargs: Any) -> StaffMember:
    record = StaffMember(
        team_id=team_record.id if team_record is not None else None,
        first_name=kwargs.pop("first_name", "Head"),
        last_name=kwargs.pop("last_name", "Coach"),
        slug=kwargs.pop("slug", "head-coach"),
        role=kwargs.pop("role", StaffRole.HEAD_COACH),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record


def fixture(team_record: Team, season_record: Season, **kwargs: Any) -> Fixture:
    supplied = kwargs.pop("opponent", None)
    opponent_record = supplied if supplied is not None else opponent()

    record = Fixture(
        team_id=team_record.id,
        opponent_id=opponent_record.id,
        season_id=season_record.id,
        slug=kwargs.pop("slug", "marines-v-rivals"),
        venue=kwargs.pop("venue", Venue.HOME),
        kickoff_at=kwargs.pop("kickoff_at", datetime(2026, 10, 3, 15, 0, tzinfo=UTC)),
        status=kwargs.pop("status", FixtureStatus.SCHEDULED),
        **kwargs,
    )
    db.session.add(record)
    db.session.flush()
    return record
