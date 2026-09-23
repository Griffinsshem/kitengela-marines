from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import Role, RoleKey, Sponsor, Submission, SubmissionStatus, User
from tests import factories

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


def contact_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "A Supporter",
        "email": "supporter@example.com",
        "subject": "Joining training",
        "message": "I would like to know when the team trains.",
        # A person who read the form took longer than the minimum.
        "rendered_at": time.time() - 30,
    }
    body.update(overrides)
    return body


# --- public forms ----------------------------------------------------------


def test_a_real_message_is_stored(session: object, client: FlaskClient) -> None:
    response = client.post("/api/v1/contact", json=contact_body())

    assert response.status_code == 202
    submission = db.session.query(Submission).one()
    assert submission.kind == "contact"
    assert submission.status == SubmissionStatus.NEW


@pytest.mark.parametrize(
    ("label", "offset"),
    [
        ("honeypot filled", None),
        ("submitted instantly", 0.0),
        ("stale form", -60.0 * 60 * 24),
    ],
)
def test_automated_submissions_are_dropped_silently(
    session: object, client: FlaskClient, label: str, offset: float | None
) -> None:
    # The timestamp is built here, not in the decorator: a decorator argument
    # is evaluated once at import, so "just now" would be seconds stale by the
    # time the test runs and would read as a real submission.
    overrides: dict[str, Any] = (
        {"website": "http://spam.example"}
        if offset is None
        else {"rendered_at": time.time() + offset}
    )

    response = client.post("/api/v1/contact", json=contact_body(**overrides))

    # Accepted as far as the sender can tell: a bot that learns which attempts
    # failed can tune itself past the checks.
    assert response.status_code == 202
    assert response.get_json()["data"]["received"] is True
    assert db.session.query(Submission).count() == 0


def test_a_missing_timestamp_is_not_treated_as_a_bot(session: object, client: FlaskClient) -> None:
    body = contact_body()
    del body["rendered_at"]

    client.post("/api/v1/contact", json=body)

    assert db.session.query(Submission).count() == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"message": "too short"},
        {"name": ""},
        {"message": "x" * 5001},
        {"unexpected_field": "value"},
    ],
)
def test_invalid_submissions_are_rejected(
    session: object, client: FlaskClient, overrides: dict[str, Any]
) -> None:
    response = client.post("/api/v1/contact", json=contact_body(**overrides))

    assert response.status_code == 422
    assert db.session.query(Submission).count() == 0


def test_a_partnership_enquiry_records_the_organisation(
    session: object, client: FlaskClient
) -> None:
    response = client.post(
        "/api/v1/partnership-enquiries",
        json={
            "name": "A Local Business",
            "organisation": "Kitengela Hardware",
            "email": "owner@example.com",
            "interest": "Shirt sponsorship",
            "message": "We would like to discuss supporting the club this season.",
            "rendered_at": time.time() - 30,
        },
    )

    assert response.status_code == 202
    submission = db.session.query(Submission).one()
    assert submission.kind == "partnership"
    assert submission.organisation == "Kitengela Hardware"


def test_submitted_text_is_stored_verbatim_not_interpreted(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    hostile = "<script>alert(1)</script> Please call me."
    client.post("/api/v1/contact", json=contact_body(message=hostile))

    listed = client.get("/api/v1/admin/submissions", headers=admin).get_json()["data"]

    # Stored as typed. It is shown as text, never rendered as HTML, so the
    # tags are inert rather than silently removed from somebody's message.
    assert listed[0]["message"] == hostile


def test_submissions_are_not_public(session: object, client: FlaskClient) -> None:
    client.post("/api/v1/contact", json=contact_body())

    assert client.get("/api/v1/admin/submissions").status_code == 401


@pytest.mark.rbac
def test_media_officer_cannot_read_the_inbox(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)

    response = client.get("/api/v1/admin/submissions", headers=auth(client, "media@example.com"))

    assert response.status_code == 403


def test_handling_a_message_records_who_and_when(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    client.post("/api/v1/contact", json=contact_body())
    submission_id = client.get("/api/v1/admin/submissions", headers=admin).get_json()["data"][0][
        "id"
    ]

    response = client.patch(
        f"/api/v1/admin/submissions/{submission_id}",
        json={"status": "replied", "internal_note": "Called back."},
        headers=admin,
    )

    data = response.get_json()["data"]
    assert data["status"] == "replied"
    assert data["handled_by"] == "Test User"
    assert data["handled_at"] is not None


def test_the_message_itself_cannot_be_edited(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    client.post("/api/v1/contact", json=contact_body())
    submission_id = client.get("/api/v1/admin/submissions", headers=admin).get_json()["data"][0][
        "id"
    ]

    response = client.patch(
        f"/api/v1/admin/submissions/{submission_id}",
        json={"message": "Something they never said."},
        headers=admin,
    )

    assert response.status_code == 422


# --- sponsors --------------------------------------------------------------


def test_no_sponsors_means_an_empty_list_not_invented_ones(
    session: object, client: FlaskClient
) -> None:
    response = client.get("/api/v1/sponsors")

    assert response.status_code == 200
    assert response.get_json()["data"] == []


def test_an_inactive_sponsor_stays_off_the_public_list(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    client.post(
        "/api/v1/admin/sponsors",
        json={"name": "Kitengela Hardware", "tier": "official", "is_active": False},
        headers=admin,
    )

    assert client.get("/api/v1/sponsors").get_json()["data"] == []


def test_a_sponsor_website_must_be_https(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/admin/sponsors",
        json={"name": "Kitengela Hardware", "website_url": "http://example.com"},
        headers=admin,
    )

    assert response.status_code == 422
    assert db.session.query(Sponsor).count() == 0


def test_a_sponsor_logo_cannot_be_deleted_while_in_use(
    session: object, client: FlaskClient, admin: dict[str, str]
) -> None:
    asset = factories.media_asset(alt_text="Kitengela Hardware logo")
    db.session.commit()
    client.post(
        "/api/v1/admin/sponsors",
        json={"name": "Kitengela Hardware", "logo_asset_id": str(asset.id)},
        headers=admin,
    )

    blocked = client.delete(f"/api/v1/admin/media/assets/{asset.id}", headers=admin)

    assert blocked.status_code == 409
    assert "sponsor" in blocked.get_json()["error"]["message"]


def test_contact_form_is_rate_limited(
    session: object, client: FlaskClient, rate_limited_client: FlaskClient
) -> None:
    statuses = [
        rate_limited_client.post("/api/v1/contact", json=contact_body()).status_code
        for _ in range(5)
    ]

    assert 429 in statuses
