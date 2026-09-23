from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient
from pydantic import ValidationError

from app.config import Settings
from app.extensions import db
from app.models import AuditLog, Club, Role, RoleKey, SocialLink, SupportMethod, User

PASSWORD = "a-sufficiently-long-password"


@pytest.fixture
def roles(app: Flask) -> Iterator[dict[RoleKey, Role]]:
    keys = (RoleKey.CLUB_ADMIN, RoleKey.MEDIA_OFFICER)
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


def auth(client: FlaskClient, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


@pytest.fixture
def admin(session: object, client: FlaskClient, roles: dict[RoleKey, Role]) -> dict[str, str]:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    return auth(client, "admin@example.com")


CLUB = {
    "name": "Kitengela Marines",
    "short_name": "Marines",
    "town": "Kitengela",
    "county": "Kajiado",
}


# --- club profile ----------------------------------------------------------


def test_club_is_created_then_updated_through_one_endpoint(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    created = client.put("/api/v1/admin/club", json=CLUB, headers=admin)
    assert created.status_code == 201
    assert created.get_json()["data"]["slug"] == "kitengela-marines"

    updated = client.put(
        "/api/v1/admin/club",
        json={**CLUB, "home_ground": "Kitengela Stadium"},
        headers=admin,
    )

    assert updated.status_code == 200
    assert db.session.query(Club).count() == 1
    assert client.get("/api/v1/club").get_json()["data"]["home_ground"] == "Kitengela Stadium"


def test_renaming_the_club_keeps_its_slug(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    client.put("/api/v1/admin/club", json=CLUB, headers=admin)

    renamed = client.put(
        "/api/v1/admin/club", json={**CLUB, "name": "Kitengela Marines FC"}, headers=admin
    )

    # The slug is in the public URL; renaming must not break links.
    assert renamed.get_json()["data"]["slug"] == "kitengela-marines"


@pytest.mark.parametrize(
    "overrides",
    [
        {"founded_year": 1800},
        {"founded_year": 2999},
        {"contact_email": "not-an-email"},
        {"name": ""},
    ],
)
def test_invalid_club_details_are_rejected(
    session: object, client: FlaskClient, admin: dict[str, str], overrides: dict[str, Any]
) -> None:
    response = client.put("/api/v1/admin/club", json={**CLUB, **overrides}, headers=admin)

    assert response.status_code == 422
    assert db.session.query(Club).count() == 0


@pytest.mark.rbac
def test_media_officer_cannot_edit_the_club_record(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)

    response = client.put(
        "/api/v1/admin/club", json=CLUB, headers=auth(client, "media@example.com")
    )

    assert response.status_code == 403


# --- social links ----------------------------------------------------------


@pytest.mark.parametrize(
    ("platform", "url"),
    [
        ("facebook", "https://www.facebook.com/kitengelamarines"),
        ("x", "https://x.com/kitengelamarines"),
        ("whatsapp", "https://chat.whatsapp.com/ABC123"),
        ("youtube", "https://www.youtube.com/@kitengelamarines"),
    ],
)
def test_links_on_their_own_platform_are_accepted(
    session: object, client: FlaskClient, admin: dict[str, str], platform: str, url: str
) -> None:
    response = client.post(
        "/api/v1/admin/social-links", json={"platform": platform, "url": url}, headers=admin
    )

    assert response.status_code == 201


@pytest.mark.parametrize(
    ("platform", "url"),
    [
        # Right platform, wrong site.
        ("facebook", "https://evil.example/kitengelamarines"),
        # Suffix attack: the host only ends with facebook.com's name.
        ("facebook", "https://facebook.com.evil.example/page"),
        # A real platform, but not the one claimed.
        ("instagram", "https://www.facebook.com/kitengelamarines"),
        # Not https.
        ("facebook", "http://www.facebook.com/kitengelamarines"),
    ],
)
def test_links_pointing_off_platform_are_refused(
    session: object, client: FlaskClient, admin: dict[str, str], platform: str, url: str
) -> None:
    response = client.post(
        "/api/v1/admin/social-links", json={"platform": platform, "url": url}, headers=admin
    )

    assert response.status_code == 422
    assert db.session.query(SocialLink).count() == 0


def test_a_platform_may_only_have_one_link(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    body = {"platform": "facebook", "url": "https://www.facebook.com/kitengelamarines"}
    client.post("/api/v1/admin/social-links", json=body, headers=admin)

    duplicate = client.post("/api/v1/admin/social-links", json=body, headers=admin)

    assert duplicate.status_code == 409


def test_inactive_links_stay_off_the_public_list(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    client.post(
        "/api/v1/admin/social-links",
        json={
            "platform": "facebook",
            "url": "https://www.facebook.com/kitengelamarines",
            "is_active": False,
        },
        headers=admin,
    )

    assert client.get("/api/v1/social-links").get_json()["data"] == []


# --- support methods -------------------------------------------------------


PAYBILL = {
    "name": "M-Pesa Paybill",
    "kind": "mpesa_paybill",
    "account_label": "Paybill",
    "account_value": "123456",
    "account_name": "Kitengela Marines",
}


def test_a_support_method_is_inactive_until_published(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    created = client.post("/api/v1/admin/support-methods", json=PAYBILL, headers=admin)

    assert created.status_code == 201
    # A payment destination goes public deliberately, not on being typed.
    assert created.get_json()["data"]["is_active"] is False
    assert client.get("/api/v1/support-methods").get_json()["data"] == []

    method_id = created.get_json()["data"]["id"]
    client.patch(
        f"/api/v1/admin/support-methods/{method_id}", json={"is_active": True}, headers=admin
    )

    published = client.get("/api/v1/support-methods").get_json()["data"]
    assert published[0]["account_value"] == "123456"


def test_a_payment_method_needs_a_destination(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/admin/support-methods",
        json={"name": "M-Pesa Paybill", "kind": "mpesa_paybill"},
        headers=admin,
    )

    assert response.status_code == 422
    assert db.session.query(SupportMethod).count() == 0


def test_changing_where_money_goes_is_audited_distinctly(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    method_id = client.post(
        "/api/v1/admin/support-methods", json=PAYBILL, headers=admin
    ).get_json()["data"]["id"]

    client.patch(
        f"/api/v1/admin/support-methods/{method_id}", json={"display_order": 2}, headers=admin
    )
    client.patch(
        f"/api/v1/admin/support-methods/{method_id}",
        json={"account_value": "999999"},
        headers=admin,
    )

    actions = [entry.action for entry in db.session.query(AuditLog).all()]
    assert "support_method.account_changed" in actions
    assert "support_method.updated" in actions


@pytest.mark.rbac
def test_media_officer_cannot_touch_payment_destinations(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)

    response = client.post(
        "/api/v1/admin/support-methods", json=PAYBILL, headers=auth(client, "media@example.com")
    )

    assert response.status_code == 403
    assert db.session.query(SupportMethod).count() == 0


# --- hashing profile -------------------------------------------------------


def test_production_refuses_the_test_hashing_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "PASSWORD_HASHING", "fast")

    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            APP_ENV="production",
            SECRET_KEY="a-long-production-secret-key-value-here-ok",
            JWT_SECRET_KEY="a-different-long-production-jwt-key-value",
            DATABASE_URL="postgresql+psycopg://user:pass@host:5432/db",
            CORS_ORIGINS="https://example.com",
            JWT_COOKIE_SECURE=True,
            MEDIA_BACKEND="cloudinary",
            CLOUDINARY_CLOUD_NAME="name",
            CLOUDINARY_API_KEY="key",
            CLOUDINARY_API_SECRET="secret",
        )
