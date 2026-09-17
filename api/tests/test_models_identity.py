from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Club,
    MembershipCapacity,
    Role,
    RoleKey,
    Team,
    TeamGender,
    TeamMembership,
    User,
)


def make_user(email: str = "Coach@Example.COM") -> User:
    user = User(email=email, full_name="Test User")
    user.set_password("a-sufficiently-long-password")
    db.session.add(user)
    db.session.flush()
    return user


def make_team(slug: str, gender: TeamGender) -> Team:
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


@pytest.mark.auth
def test_password_is_hashed_not_stored(session: object) -> None:
    user = make_user()
    db.session.commit()

    assert "a-sufficiently-long-password" not in user.password_hash
    assert user.password_hash.startswith("$argon2id$")
    assert user.check_password("a-sufficiently-long-password") is True
    assert user.check_password("wrong") is False


@pytest.mark.auth
def test_email_is_normalised_and_unique(session: object) -> None:
    make_user("Coach@Example.COM")
    db.session.commit()

    assert db.session.query(User).one().email == "coach@example.com"
    with pytest.raises(IntegrityError):
        make_user("COACH@example.com")

    db.session.rollback()
    assert db.session.query(User).count() == 1


@pytest.mark.rbac
def test_roles_are_separate_from_team_scope(session: object) -> None:
    coach_role = Role(key=RoleKey.COACH, label="Coach")
    db.session.add(coach_role)

    user = make_user()
    user.roles.append(coach_role)

    men = make_team("marines-men", TeamGender.MEN)
    starlets = make_team("starlets", TeamGender.WOMEN)

    db.session.add(
        TeamMembership(user_id=user.id, team_id=starlets.id, capacity=MembershipCapacity.COACH)
    )
    db.session.commit()
    db.session.refresh(user)

    assert user.has_role(RoleKey.COACH)
    assert user.is_club_admin is False
    assert user.team_ids_for(MembershipCapacity.COACH) == {starlets.id}
    assert men.id not in user.team_ids_for()


@pytest.mark.rbac
def test_revoked_membership_drops_out_of_scope(session: object) -> None:
    user = make_user()
    team = make_team("marines-men", TeamGender.MEN)
    membership = TeamMembership(
        user_id=user.id, team_id=team.id, capacity=MembershipCapacity.MANAGER
    )
    db.session.add(membership)
    db.session.commit()

    assert user.team_ids_for() == {team.id}

    membership.is_active = False
    db.session.commit()
    db.session.refresh(user)

    assert user.team_ids_for() == set()


@pytest.mark.rbac
def test_membership_is_unique_per_capacity(session: object) -> None:
    user = make_user()
    team = make_team("marines-men", TeamGender.MEN)
    for _ in range(2):
        db.session.add(
            TeamMembership(user_id=user.id, team_id=team.id, capacity=MembershipCapacity.COACH)
        )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
