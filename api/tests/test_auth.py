from __future__ import annotations

from collections.abc import Iterator

import pytest
from flask import Flask
from flask.testing import FlaskClient

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
from app.security.authorization import has_capability, has_team_scope
from app.security.permissions import Capability

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


def make_user(email: str, *role_keys: RoleKey, active: bool = True) -> User:
    user = User(email=email, full_name="Test User", is_active=active)
    user.set_password(PASSWORD)
    for key in role_keys:
        role = db.session.query(Role).filter_by(key=key).one()
        user.roles.append(role)
    db.session.add(user)
    db.session.commit()
    return user


def make_team(slug: str) -> Team:
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
        gender=TeamGender.MEN,
        accent_key=slug,
    )
    db.session.add(team)
    db.session.commit()
    return team


def login(client: FlaskClient, email: str, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


@pytest.mark.auth
def test_login_returns_a_token_and_sets_a_refresh_cookie(
    client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)

    response = login(client, "admin@example.com")

    assert response.status_code == 200
    assert response.get_json()["access_token"]

    set_cookie_headers = response.headers.getlist("Set-Cookie")
    refresh_cookie = next(
        header for header in set_cookie_headers if header.startswith("refresh_token_cookie=")
    )
    assert "HttpOnly" in refresh_cookie
    assert "/api/v1/auth/refresh" in refresh_cookie


@pytest.mark.auth
def test_access_token_is_not_in_a_readable_cookie(
    client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    response = login(client, "admin@example.com")

    assert "access_token" in response.get_json()


@pytest.mark.auth
@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("nobody@example.com", PASSWORD),
        ("admin@example.com", "wrong-password"),
    ],
)
def test_bad_credentials_give_one_indistinguishable_error(
    client: FlaskClient, roles: dict[RoleKey, Role], email: str, password: str
) -> None:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)

    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.get_json()["error"]["message"] == "Incorrect email or password."


@pytest.mark.auth
def test_deactivated_account_cannot_log_in(client: FlaskClient, roles: dict[RoleKey, Role]) -> None:
    make_user("gone@example.com", RoleKey.MEDIA_OFFICER, active=False)

    assert login(client, "gone@example.com").status_code == 401


@pytest.mark.auth
def test_unknown_body_fields_are_rejected(client: FlaskClient, roles: dict[RoleKey, Role]) -> None:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": PASSWORD, "role": "club_admin"},
    )

    assert response.status_code == 422


@pytest.mark.auth
def test_me_requires_a_token(client: FlaskClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.auth
def test_me_returns_roles_and_capabilities(client: FlaskClient, roles: dict[RoleKey, Role]) -> None:
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)
    token = login(client, "media@example.com").get_json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    body = response.get_json()["user"]
    assert body["roles"] == ["media_officer"]
    assert "manage_news" in body["capabilities"]
    assert "manage_users" not in body["capabilities"]


@pytest.mark.auth
def test_revoking_an_account_invalidates_an_issued_token(
    client: FlaskClient, app: Flask, roles: dict[RoleKey, Role]
) -> None:
    user = make_user("temp@example.com", RoleKey.COACH)
    token = login(client, "temp@example.com").get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    with app.app_context():
        db.session.get(User, user.id).is_active = False
        db.session.commit()

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


@pytest.mark.rbac
def test_media_officer_cannot_manage_users(roles: dict[RoleKey, Role]) -> None:
    user = make_user("media@example.com", RoleKey.MEDIA_OFFICER)

    assert has_capability(user, Capability.MANAGE_NEWS) is True
    assert has_capability(user, Capability.MANAGE_USERS) is False
    assert has_capability(user, Capability.MANAGE_FIXTURES) is False


@pytest.mark.rbac
def test_club_admin_holds_every_capability(roles: dict[RoleKey, Role]) -> None:
    user = make_user("admin@example.com", RoleKey.CLUB_ADMIN)

    for capability in Capability:
        assert has_capability(user, capability) is True


@pytest.mark.rbac
def test_team_manager_is_scoped_to_their_own_team(roles: dict[RoleKey, Role]) -> None:
    user = make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    starlets = make_team("starlets")
    men = make_team("marines-men")

    db.session.add(
        TeamMembership(user_id=user.id, team_id=starlets.id, capacity=MembershipCapacity.MANAGER)
    )
    db.session.commit()
    db.session.refresh(user)

    assert has_capability(user, Capability.MANAGE_FIXTURES) is True
    assert has_team_scope(user, Capability.MANAGE_FIXTURES, starlets.id) is True
    # Holding the role is not authority over every team.
    assert has_team_scope(user, Capability.MANAGE_FIXTURES, men.id) is False


@pytest.mark.rbac
def test_coach_cannot_manage_fixtures_even_on_their_own_team(
    roles: dict[RoleKey, Role],
) -> None:
    user = make_user("coach@example.com", RoleKey.COACH)
    team = make_team("marines-men")
    db.session.add(
        TeamMembership(user_id=user.id, team_id=team.id, capacity=MembershipCapacity.COACH)
    )
    db.session.commit()
    db.session.refresh(user)

    assert has_capability(user, Capability.MANAGE_SQUAD) is True
    assert has_team_scope(user, Capability.MANAGE_SQUAD, team.id) is True
    assert has_capability(user, Capability.MANAGE_FIXTURES) is False


@pytest.mark.rbac
def test_club_admin_bypasses_team_scope(roles: dict[RoleKey, Role]) -> None:
    user = make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    team = make_team("starlets")

    assert has_team_scope(user, Capability.MANAGE_FIXTURES, team.id) is True


@pytest.mark.auth
def test_login_is_rate_limited(
    app: Flask, roles: dict[RoleKey, Role], rate_limited_client: FlaskClient
) -> None:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)

    statuses = [
        rate_limited_client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong"},
        ).status_code
        for _ in range(7)
    ]

    assert 429 in statuses
    assert statuses.count(401) == 5


@pytest.mark.auth
def test_missing_token_uses_the_standard_error_envelope(client: FlaskClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    body = response.get_json()
    assert body["error"]["code"] == "unauthenticated"
    # The extension's own {"msg": ...} shape must not reach a client, and the
    # message must not enumerate which auth mechanisms were checked.
    assert "msg" not in body
    assert "cookie" not in body["error"]["message"].lower()


@pytest.mark.auth
def test_malformed_token_is_rejected_without_detail(client: FlaskClient) -> None:
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "unauthenticated"
