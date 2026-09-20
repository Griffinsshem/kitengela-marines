from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import (
    Club,
    MembershipCapacity,
    Player,
    PlayerPosition,
    PlayerStatus,
    Role,
    RoleKey,
    StaffRole,
    TeamGender,
    TeamMembership,
    User,
)
from tests import factories

PASSWORD = "a-sufficiently-long-password"


@pytest.fixture
def roles(app: Flask) -> Iterator[dict[RoleKey, Role]]:
    keys = (
        RoleKey.CLUB_ADMIN,
        RoleKey.MEDIA_OFFICER,
        RoleKey.TEAM_MANAGER,
        RoleKey.COACH,
        RoleKey.PLAYER,
    )
    with app.app_context():
        created = {key: Role(key=key, label=key.value) for key in keys}
        db.session.add_all(created.values())
        db.session.commit()
        yield created


def make_user(email: str, *role_keys: RoleKey) -> User:
    user = User(email=email, full_name="Test User")
    user.set_password(PASSWORD)
    for key in role_keys:
        user.roles.append(db.session.query(Role).filter_by(key=key).one())
    db.session.add(user)
    db.session.commit()
    return user


def attach(user: User, team: Any, capacity: MembershipCapacity) -> None:
    db.session.add(TeamMembership(user_id=user.id, team_id=team.id, capacity=capacity))
    db.session.commit()


def auth(client: FlaskClient, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


def player_body(team: Any, **overrides: Any) -> dict[str, Any]:
    body = {
        "team_id": str(team.id),
        "first_name": "New",
        "last_name": "Signing",
        "position": PlayerPosition.MIDFIELDER.value,
    }
    body.update(overrides)
    return body


# --- authentication --------------------------------------------------------


@pytest.mark.rbac
def test_admin_routes_require_a_token(session: object, client: FlaskClient) -> None:
    team = factories.team()
    db.session.commit()

    response = client.post("/api/v1/admin/players", json=player_body(team))

    assert response.status_code == 401


@pytest.mark.rbac
def test_media_officer_cannot_create_players(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)
    db.session.commit()

    response = client.post(
        "/api/v1/admin/players",
        json=player_body(team),
        headers=auth(client, "media@example.com"),
    )

    assert response.status_code == 403
    assert db.session.query(Player).count() == 0


# --- team scoping ----------------------------------------------------------


@pytest.mark.rbac
def test_coach_can_create_a_player_in_their_own_squad(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team("starlets", gender=TeamGender.WOMEN)
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, team, MembershipCapacity.COACH)

    response = client.post(
        "/api/v1/admin/players",
        json=player_body(team),
        headers=auth(client, "coach@example.com"),
    )

    assert response.status_code == 201
    assert response.get_json()["data"]["slug"] == "new-signing"


@pytest.mark.rbac
def test_starlets_coach_cannot_touch_the_mens_squad(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    men = factories.team("marines-men")
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, starlets, MembershipCapacity.COACH)

    headers = auth(client, "coach@example.com")

    # Creating into the other squad is refused on the body's team_id.
    created = client.post("/api/v1/admin/players", json=player_body(men), headers=headers)
    assert created.status_code == 403

    # Editing an existing player of the other squad is refused too.
    outsider = factories.player(men, "Mens", "Player")
    db.session.commit()
    edited = client.patch(
        f"/api/v1/admin/players/{outsider.id}",
        json={"biography": "edited"},
        headers=headers,
    )
    assert edited.status_code == 403
    db.session.refresh(outsider)
    assert outsider.biography is None


@pytest.mark.rbac
def test_transfer_requires_scope_on_both_teams(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    men = factories.team("marines-men")
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, starlets, MembershipCapacity.COACH)
    player = factories.player(starlets, "Squad", "Member")
    db.session.commit()

    response = client.post(
        f"/api/v1/admin/players/{player.id}/transfer",
        json={"team_id": str(men.id)},
        headers=auth(client, "coach@example.com"),
    )

    assert response.status_code == 403
    db.session.refresh(player)
    assert player.team_id == starlets.id


@pytest.mark.rbac
def test_club_admin_bypasses_team_scope(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.post(
        "/api/v1/admin/players",
        json=player_body(team),
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 201


# --- mass assignment -------------------------------------------------------


@pytest.mark.rbac
def test_coach_cannot_move_a_player_by_patching_team_id(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    men = factories.team("marines-men")
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, starlets, MembershipCapacity.COACH)
    player = factories.player(starlets, "Squad", "Member")
    db.session.commit()

    response = client.patch(
        f"/api/v1/admin/players/{player.id}",
        json={"biography": "fine", "team_id": str(men.id)},
        headers=auth(client, "coach@example.com"),
    )

    # The schema does not declare team_id, so the whole request fails.
    assert response.status_code == 422
    db.session.refresh(player)
    assert player.team_id == starlets.id
    assert player.biography is None


@pytest.mark.rbac
def test_unknown_fields_are_rejected_on_create(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.post(
        "/api/v1/admin/players",
        json=player_body(team, slug="chosen-by-client", id="00000000-0000-0000-0000-000000000001"),
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 422


# --- player self-service ---------------------------------------------------


@pytest.mark.rbac
def test_player_edits_only_their_permitted_fields(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    user = make_user("player@example.com", RoleKey.PLAYER)
    player = factories.player(team, "Own", "Profile", squad_number=7)
    player.user_id = user.id
    db.session.commit()

    headers = auth(client, "player@example.com")

    allowed = client.patch(
        "/api/v1/admin/players/me", json={"biography": "My story"}, headers=headers
    )
    assert allowed.status_code == 200

    refused = client.patch(
        "/api/v1/admin/players/me",
        json={"squad_number": 9, "status": PlayerStatus.INJURED.value},
        headers=headers,
    )
    assert refused.status_code == 422

    db.session.refresh(player)
    assert player.biography == "My story"
    assert player.squad_number == 7
    assert player.status == PlayerStatus.ACTIVE


@pytest.mark.rbac
def test_player_cannot_edit_another_player(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    user = make_user("player@example.com", RoleKey.PLAYER)
    own = factories.player(team, "Own", "Profile")
    own.user_id = user.id
    other = factories.player(team, "Other", "Player")
    db.session.commit()

    response = client.patch(
        f"/api/v1/admin/players/{other.id}",
        json={"biography": "not mine to write"},
        headers=auth(client, "player@example.com"),
    )

    assert response.status_code == 403
    db.session.refresh(other)
    assert other.biography is None


# --- private data ----------------------------------------------------------


@pytest.mark.rbac
def test_private_data_needs_capability_and_scope(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    men = factories.team("marines-men")
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, starlets, MembershipCapacity.COACH)
    factories.player(starlets, "Private", "Data", phone="+254700000000")
    db.session.commit()

    headers = auth(client, "coach@example.com")

    own = client.get(f"/api/v1/admin/teams/{starlets.id}/players", headers=headers)
    assert own.status_code == 200
    assert own.get_json()["data"][0]["phone"] == "+254700000000"

    other = client.get(f"/api/v1/admin/teams/{men.id}/players", headers=headers)
    assert other.status_code == 403


# --- validation ------------------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"squad_number": 0},
        {"squad_number": 100},
        {"position": "striker"},
        {"first_name": ""},
        {"date_of_birth": "2099-01-01"},
    ],
)
def test_invalid_player_payloads_are_rejected(
    session: object,
    client: FlaskClient,
    roles: dict[RoleKey, Role],
    overrides: dict[str, Any],
) -> None:
    team = factories.team()
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    response = client.post(
        "/api/v1/admin/players",
        json=player_body(team, **overrides),
        headers=auth(client, "admin@example.com"),
    )

    assert response.status_code == 422
    assert db.session.query(Player).count() == 0


# --- deletion --------------------------------------------------------------


@pytest.mark.rbac
def test_coach_cannot_delete_a_player(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, team, MembershipCapacity.COACH)
    player = factories.player(team, "Squad", "Member")
    db.session.commit()

    response = client.delete(
        f"/api/v1/admin/players/{player.id}", headers=auth(client, "coach@example.com")
    )

    assert response.status_code == 403
    assert db.session.query(Player).count() == 1


# --- teams and staff -------------------------------------------------------


@pytest.mark.rbac
def test_only_club_admin_creates_teams(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    db.session.add(Club(name="Kitengela Marines", short_name="Marines", slug="kitengela-marines"))
    manager = make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    body = {
        "name": "Kitengela Marines U17",
        "short_name": "Marines U17",
        "gender": TeamGender.MEN.value,
        "accent_key": "marines-men",
    }

    refused = client.post(
        "/api/v1/admin/teams", json=body, headers=auth(client, "manager@example.com")
    )
    assert refused.status_code == 403

    created = client.post(
        "/api/v1/admin/teams", json=body, headers=auth(client, "admin@example.com")
    )
    assert created.status_code == 201
    # Adding a youth side is an insert, exactly as the schema was designed for.
    assert created.get_json()["data"]["slug"] == "kitengela-marines-u17"

    _ = manager


@pytest.mark.rbac
def test_only_club_admin_manages_club_wide_staff(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    manager = make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    attach(manager, team, MembershipCapacity.MANAGER)
    db.session.commit()

    headers = auth(client, "manager@example.com")

    club_wide = client.post(
        "/api/v1/admin/staff",
        json={"first_name": "Club", "last_name": "Official", "role": StaffRole.OFFICIAL.value},
        headers=headers,
    )
    assert club_wide.status_code == 403
