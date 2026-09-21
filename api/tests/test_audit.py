from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import (
    AuditLog,
    MembershipCapacity,
    PlayerPosition,
    Role,
    RoleKey,
    TeamGender,
    TeamMembership,
    User,
)
from tests import factories

PASSWORD = "a-sufficiently-long-password"


@pytest.fixture
def roles(app: Flask) -> Iterator[dict[RoleKey, Role]]:
    keys = (RoleKey.CLUB_ADMIN, RoleKey.TEAM_MANAGER, RoleKey.COACH, RoleKey.MEDIA_OFFICER)
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


def entries(action: str | None = None) -> list[AuditLog]:
    query = db.session.query(AuditLog)
    if action:
        query = query.filter_by(action=action)
    return query.all()


def test_creating_a_player_is_recorded_with_the_actor(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    client.post(
        "/api/v1/admin/players",
        json={
            "team_id": str(team.id),
            "first_name": "New",
            "last_name": "Signing",
            "position": PlayerPosition.MIDFIELDER.value,
        },
        headers=auth(client, "admin@example.com"),
    )

    logged = entries("player.created")
    assert len(logged) == 1
    assert logged[0].actor_email == "admin@example.com"
    assert logged[0].target_label == "new-signing"
    assert logged[0].target_id is not None


def test_an_update_records_which_fields_changed_but_not_their_values(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    player = factories.player(team, "Squad", "Member")
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    client.patch(
        f"/api/v1/admin/players/{player.id}",
        json={"biography": "A new biography", "phone": "+254700000000"},
        headers=auth(client, "admin@example.com"),
    )

    logged = entries("player.updated")
    assert len(logged) == 1
    assert logged[0].changed_fields == ["biography", "phone"]

    # Field names only. A phone number must not be copied into a table that
    # outlives the record it came from.
    serialised = str(logged[0].to_dict())
    assert "+254700000000" not in serialised


def test_named_actions_capture_intent(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    current = factories.season()
    match = factories.fixture(team, current)
    scorer = factories.player(team, "Goal", "Scorer", position=PlayerPosition.FORWARD)
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    client.put(
        f"/api/v1/admin/fixtures/{match.id}/result",
        json={
            "our_score": 1,
            "their_score": 0,
            "lineup": [{"player_id": str(scorer.id), "lineup_role": "starter", "goals": 1}],
        },
        headers=auth(client, "admin@example.com"),
    )

    # Not 'fixture.updated' — the log says what was actually done.
    assert len(entries("result.recorded")) >= 1


def test_role_assignment_is_recorded(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("someone@example.com", RoleKey.COACH)

    # user_roles is an association table the ORM listener cannot see directly,
    # so grants are captured from the user's roles history instead.
    granted = entries("user.role_granted")
    assert len(granted) == 1
    assert granted[0].target_label == "someone@example.com: coach"
    assert granted[0].target_id is not None


def test_role_revocation_is_recorded(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    user = make_user("someone@example.com", RoleKey.COACH)

    user.roles.clear()
    db.session.commit()

    revoked = entries("user.role_revoked")
    assert len(revoked) == 1
    assert revoked[0].target_label == "someone@example.com: coach"


def test_logging_in_is_not_an_audited_change(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    before = len(entries())

    auth(client, "admin@example.com")

    # last_login_at is bookkeeping, not an administrative change.
    assert len(entries()) == before


def test_password_changes_never_name_the_hash(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    user = make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()
    headers = auth(client, "admin@example.com")

    client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": PASSWORD,
            "new_password": "a-completely-different-password",
        },
        headers=headers,
    )

    for entry in entries():
        assert "password_hash" not in (entry.changed_fields or [])

    _ = user


def test_a_refused_request_writes_nothing(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    men = factories.team("marines-men")
    coach = make_user("coach@example.com", RoleKey.COACH)
    attach(coach, starlets, MembershipCapacity.COACH)
    db.session.commit()

    headers = auth(client, "coach@example.com")
    before = len(entries())

    refused = client.post(
        "/api/v1/admin/players",
        json={
            "team_id": str(men.id),
            "first_name": "Not",
            "last_name": "Allowed",
            "position": PlayerPosition.MIDFIELDER.value,
        },
        headers=headers,
    )

    assert refused.status_code == 403
    assert len(entries()) == before


def test_reads_are_not_audited(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    factories.team()
    db.session.commit()
    before = len(entries())

    client.get("/api/v1/teams")
    client.get("/api/v1/fixtures")

    assert len(entries()) == before


@pytest.mark.rbac
def test_only_club_admin_reads_the_audit_log(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    make_user("admin@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    refused = client.get("/api/v1/admin/audit-logs", headers=auth(client, "manager@example.com"))
    assert refused.status_code == 403

    allowed = client.get("/api/v1/admin/audit-logs", headers=auth(client, "admin@example.com"))
    assert allowed.status_code == 200
    assert "meta" in allowed.get_json()


def test_audit_entries_survive_deleting_the_actor(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    team = factories.team()
    user = make_user("temp@example.com", RoleKey.CLUB_ADMIN)
    db.session.commit()

    client.post(
        "/api/v1/admin/players",
        json={
            "team_id": str(team.id),
            "first_name": "Created",
            "last_name": "Before",
            "position": PlayerPosition.MIDFIELDER.value,
        },
        headers=auth(client, "temp@example.com"),
    )

    db.session.delete(db.session.get(User, user.id))
    db.session.commit()

    logged = entries("player.created")
    assert len(logged) == 1
    assert logged[0].actor_id is None
    # The email survives, so the record still says who did it.
    assert logged[0].actor_email == "temp@example.com"
