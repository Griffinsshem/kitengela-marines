"""Account administration.

The tests that matter here are the two lockout guards. Everything else in the
admin can be undone by somebody with an account; locking the last
administrator out cannot, and would need database access to repair, which is
the situation this whole feature exists to avoid.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import Role, RoleKey, TeamGender, User

from . import factories

os.environ.setdefault("PASSWORD_HASHING", "fast")

PASSWORD = "a-sufficiently-long-password"


def _auth(client: FlaskClient, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


@pytest.fixture
def roles(app: Flask) -> Iterator[dict[RoleKey, Role]]:
    """Roles live per test file rather than in conftest, so each file declares
    only the ones it needs. Coach is here because this file creates coaches."""
    keys = (RoleKey.CLUB_ADMIN, RoleKey.MEDIA_OFFICER, RoleKey.COACH, RoleKey.TEAM_MANAGER)
    with app.app_context():
        created = {key: Role(key=key, label=key.value) for key in keys}
        db.session.add_all(created.values())
        db.session.commit()
        yield created


@pytest.fixture
def owner(session: object, client: FlaskClient, roles: dict[RoleKey, Role]) -> dict[str, str]:
    user = User(email="owner@example.com", full_name="Club Owner")
    user.set_password(PASSWORD)
    user.roles.append(roles[RoleKey.CLUB_ADMIN])
    db.session.add(user)
    db.session.commit()
    return _auth(client, "owner@example.com")


def test_an_account_is_created_with_a_password_shown_once(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/admin/users",
        json={
            "email": "officer@example.com",
            "full_name": "Media Officer",
            "role": "media_officer",
        },
        headers=owner,
    )

    assert response.status_code == 201
    body = response.get_json()
    password = body["temporary_password"]
    assert len(password) >= 16

    # The new account works with it, which is the only proof that matters.
    login = client.post(
        "/api/v1/auth/login", json={"email": "officer@example.com", "password": password}
    )
    assert login.status_code == 200

    # And it is nowhere in the listing: issued once, never retrievable.
    listing = client.get("/api/v1/admin/users", headers=owner)
    assert password not in listing.get_data(as_text=True)


def test_a_team_scoped_role_requires_a_team(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    """A coach attached to no team has no capability at all, so an account
    like that is not worth creating."""
    response = client.post(
        "/api/v1/admin/users",
        json={"email": "coach@example.com", "full_name": "A Coach", "role": "coach"},
        headers=owner,
    )

    assert response.status_code == 422
    assert db.session.query(User).filter_by(email="coach@example.com").first() is None


def test_a_coach_is_scoped_to_the_teams_chosen(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    team = factories.team("starlets", gender=TeamGender.WOMEN)
    db.session.commit()

    response = client.post(
        "/api/v1/admin/users",
        json={
            "email": "coach@example.com",
            "full_name": "A Coach",
            "role": "coach",
            "team_ids": [str(team.id)],
        },
        headers=owner,
    )

    assert response.status_code == 201
    assert response.get_json()["data"]["teams"] == [team.short_name]


def test_you_cannot_deactivate_your_own_account(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    me = db.session.query(User).filter_by(email="owner@example.com").one()

    response = client.patch(
        f"/api/v1/admin/users/{me.id}", json={"is_active": False}, headers=owner
    )

    assert response.status_code == 409
    db.session.refresh(me)
    assert me.is_active is True


def test_you_cannot_remove_your_own_club_admin_role(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    """Without this the last administrator can lock the club out of its own
    site, and only database access could put it back."""
    me = db.session.query(User).filter_by(email="owner@example.com").one()

    response = client.patch(
        f"/api/v1/admin/users/{me.id}", json={"role": "media_officer"}, headers=owner
    )

    assert response.status_code == 409
    db.session.refresh(me)
    assert me.is_club_admin is True


def test_a_deactivated_account_cannot_sign_in(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    created = client.post(
        "/api/v1/admin/users",
        json={
            "email": "officer@example.com",
            "full_name": "Media Officer",
            "role": "media_officer",
        },
        headers=owner,
    )
    password = created.get_json()["temporary_password"]
    user_id = created.get_json()["data"]["id"]

    client.patch(f"/api/v1/admin/users/{user_id}", json={"is_active": False}, headers=owner)

    refused = client.post(
        "/api/v1/auth/login", json={"email": "officer@example.com", "password": password}
    )
    assert refused.status_code == 401


def test_a_password_reset_signs_the_account_out_everywhere(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    created = client.post(
        "/api/v1/admin/users",
        json={
            "email": "officer@example.com",
            "full_name": "Media Officer",
            "role": "media_officer",
        },
        headers=owner,
    )
    user_id = created.get_json()["data"]["id"]
    old_password = created.get_json()["temporary_password"]
    token = client.post(
        "/api/v1/auth/login", json={"email": "officer@example.com", "password": old_password}
    ).get_json()["access_token"]
    officer = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=officer).status_code == 200

    reset = client.post(f"/api/v1/admin/users/{user_id}/password", headers=owner)
    new_password = reset.get_json()["temporary_password"]

    # Whoever held the old password, and the session it opened, is out.
    assert client.get("/api/v1/auth/me", headers=officer).status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 401
    # The new password works straight away, even within the same second.
    signed_in = client.post(
        "/api/v1/auth/login", json={"email": "officer@example.com", "password": new_password}
    )
    assert signed_in.status_code == 200
    fresh = {"Authorization": f"Bearer {signed_in.get_json()['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=fresh).status_code == 200


def test_reactivating_an_account_does_not_revive_its_old_sessions(
    session: object, client: FlaskClient, owner: dict[str, str]
) -> None:
    created = client.post(
        "/api/v1/admin/users",
        json={
            "email": "officer@example.com",
            "full_name": "Media Officer",
            "role": "media_officer",
        },
        headers=owner,
    )
    user_id = created.get_json()["data"]["id"]
    password = created.get_json()["temporary_password"]
    token = client.post(
        "/api/v1/auth/login", json={"email": "officer@example.com", "password": password}
    ).get_json()["access_token"]
    officer = {"Authorization": f"Bearer {token}"}

    client.patch(f"/api/v1/admin/users/{user_id}", json={"is_active": False}, headers=owner)
    client.patch(f"/api/v1/admin/users/{user_id}", json={"is_active": True}, headers=owner)

    assert client.get("/api/v1/auth/me", headers=officer).status_code == 401
