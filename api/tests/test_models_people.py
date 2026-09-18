from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Club,
    Player,
    PlayerPosition,
    PlayerStatus,
    StaffMember,
    StaffRole,
    Team,
    TeamGender,
)
from app.utils.slugs import unique_slug


def make_team(slug: str = "marines-men", gender: TeamGender = TeamGender.MEN) -> Team:
    club = db.session.query(Club).first()
    if club is None:
        club = Club(name="Kitengela Marines", short_name="Marines", slug="kitengela-marines")
        db.session.add(club)
        db.session.flush()
    team = Team(
        club_id=club.id,
        name=slug,
        short_name=slug,
        slug=slug,
        gender=gender,
        accent_key=slug,
    )
    db.session.add(team)
    db.session.flush()
    return team


def make_player(team: Team, first: str, last: str, **kwargs: object) -> Player:
    player = Player(
        team_id=team.id,
        first_name=first,
        last_name=last,
        slug=unique_slug(
            f"{first} {last}",
            lambda candidate: (
                db.session.query(Player).filter_by(team_id=team.id, slug=candidate).first()
                is not None
            ),
        ),
        position=kwargs.pop("position", PlayerPosition.MIDFIELDER),
        **kwargs,
    )
    db.session.add(player)
    db.session.flush()
    return player


def test_private_fields_never_reach_the_public_payload(session: object) -> None:
    team = make_team()
    player = make_player(
        team,
        "Test",
        "Player",
        date_of_birth=None,
        phone="+254700000000",
        emergency_contact_name="Next Of Kin",
        internal_notes="internal only",
    )
    db.session.commit()

    payload = player.public_dict()

    for private in (
        "date_of_birth",
        "phone",
        "emergency_contact_name",
        "emergency_contact_phone",
        "internal_notes",
        "user_id",
        "team_id",
    ):
        assert private not in payload

    assert payload["slug"] == "test-player"
    assert payload["display_name"] == "Test Player"


def test_known_as_overrides_display_name(session: object) -> None:
    team = make_team()
    player = make_player(team, "Test", "Player", known_as="TP")
    db.session.commit()

    assert player.display_name == "TP"
    assert player.full_name == "Test Player"


def test_slug_collision_gets_a_suffix(session: object) -> None:
    team = make_team()
    first = make_player(team, "Same", "Name")
    second = make_player(team, "Same", "Name")
    db.session.commit()

    assert first.slug == "same-name"
    assert second.slug == "same-name-2"


def test_slug_is_unique_within_a_team(session: object) -> None:
    team = make_team()
    for _ in range(2):
        db.session.add(
            Player(
                team_id=team.id,
                first_name="Clash",
                last_name="Test",
                slug="clash-test",
                position=PlayerPosition.DEFENDER,
            )
        )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_same_slug_allowed_across_different_teams(session: object) -> None:
    men = make_team("marines-men", TeamGender.MEN)
    starlets = make_team("starlets", TeamGender.WOMEN)

    db.session.add_all(
        [
            Player(
                team_id=men.id,
                first_name="Shared",
                last_name="Name",
                slug="shared-name",
                position=PlayerPosition.FORWARD,
            ),
            Player(
                team_id=starlets.id,
                first_name="Shared",
                last_name="Name",
                slug="shared-name",
                position=PlayerPosition.FORWARD,
            ),
        ]
    )
    db.session.commit()

    assert db.session.query(Player).count() == 2


def test_former_players_leave_the_current_squad(session: object) -> None:
    team = make_team()
    active = make_player(team, "Current", "Player")
    injured = make_player(team, "Injured", "Player", status=PlayerStatus.INJURED)
    former = make_player(team, "Former", "Player", status=PlayerStatus.FORMER)
    db.session.commit()

    assert active.is_in_current_squad is True
    # Injured is still squad: the status is shown, not hidden.
    assert injured.is_in_current_squad is True
    assert former.is_in_current_squad is False


def test_squad_orders_numbered_players_before_unnumbered(session: object) -> None:
    team = make_team()
    make_player(team, "Nine", "Player", squad_number=9)
    make_player(team, "One", "Player", squad_number=1)
    make_player(team, "Trialist", "Player")
    db.session.commit()
    db.session.refresh(team)

    assert [player.squad_number for player in team.players] == [1, 9, None]


def test_staff_may_be_club_wide_or_team_specific(session: object) -> None:
    team = make_team()
    db.session.add_all(
        [
            StaffMember(
                team_id=team.id,
                first_name="Head",
                last_name="Coach",
                slug="head-coach",
                role=StaffRole.HEAD_COACH,
                email="internal@example.com",
            ),
            StaffMember(
                team_id=None,
                first_name="Club",
                last_name="Official",
                slug="club-official",
                role=StaffRole.OFFICIAL,
            ),
        ]
    )
    db.session.commit()

    official = db.session.query(StaffMember).filter_by(slug="club-official").one()
    coach = db.session.query(StaffMember).filter_by(slug="head-coach").one()

    assert official.team_id is None
    assert "email" not in coach.public_dict()
    assert coach.public_dict()["full_name"] == "Head Coach"
