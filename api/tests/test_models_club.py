from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Club, Team, TeamCategory, TeamGender


def make_club() -> Club:
    club = Club(name="Kitengela Marines", short_name="Marines", slug="kitengela-marines")
    db.session.add(club)
    db.session.flush()
    return club


def test_club_facts_stay_null_until_supplied(session: object) -> None:
    club = make_club()
    db.session.commit()
    assert club.founded_year is None
    assert club.home_ground is None


def test_both_teams_share_one_table(session: object) -> None:
    club = make_club()
    db.session.add_all(
        [
            Team(
                club_id=club.id,
                name="Kitengela Marines",
                short_name="Marines",
                slug="marines-men",
                category=TeamCategory.SENIOR,
                gender=TeamGender.MEN,
                accent_key="marines-men",
                display_order=1,
            ),
            Team(
                club_id=club.id,
                name="Marines Starlets",
                short_name="Starlets",
                slug="starlets",
                category=TeamCategory.SENIOR,
                gender=TeamGender.WOMEN,
                accent_key="starlets",
                display_order=2,
            ),
        ]
    )
    db.session.commit()
    db.session.refresh(club)

    assert [team.slug for team in club.teams] == ["marines-men", "starlets"]
    assert {team.__tablename__ for team in club.teams} == {"teams"}


def test_team_slug_is_unique(session: object) -> None:
    club = make_club()
    for _ in range(2):
        db.session.add(
            Team(
                club_id=club.id,
                name="Duplicate",
                short_name="Dup",
                slug="marines-men",
                gender=TeamGender.MEN,
                accent_key="marines-men",
            )
        )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_future_team_needs_no_schema_change(session: object) -> None:
    """Adding an academy side is an INSERT, which is the whole point."""
    club = make_club()
    db.session.add(
        Team(
            club_id=club.id,
            name="Kitengela Marines U17",
            short_name="Marines U17",
            slug="marines-u17",
            category=TeamCategory.YOUTH,
            gender=TeamGender.MEN,
            accent_key="marines-men",
        )
    )
    db.session.commit()
    assert db.session.query(Team).count() == 1
