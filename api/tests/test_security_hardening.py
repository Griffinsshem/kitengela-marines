"""Rate limiting that sees real visitors, session revocation, and API headers."""

from __future__ import annotations

import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from flask import Flask
from flask.testing import FlaskClient
from pydantic import ValidationError
from sqlalchemy import update

from app import create_app
from app.config import Settings
from app.extensions import db, limiter
from app.models import RateLimitCounter, Role, RoleKey, User
from app.security import passwords
from app.security.rate_limit_storage import DatabaseStorage

from .conftest import TEST_DATABASE_URL

PASSWORD = "a-sufficiently-long-password"


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "APP_ENV": "development",
        "SECRET_KEY": "test-only-secret-key-padded-to-at-least-thirty-two-bytes",
        "JWT_SECRET_KEY": "test-only-jwt-secret-key-padded-to-at-least-thirty-two-bytes",
        "DATABASE_URL": TEST_DATABASE_URL,
        "JWT_COOKIE_SECURE": False,
        "CORS_ORIGINS": "http://localhost:3000",
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


@pytest.fixture
def behind_cloudflare() -> Iterator[FlaskClient]:
    """Rate limiting on, counters in the database, True-Client-IP trusted.

    That is production's arrangement, apart from the environment name.
    """
    application = create_app(
        _settings(RATELIMIT_ENABLED=True, RATELIMIT_STORAGE="database", TRUST_CLIENT_IP_HEADER=True)
    )
    with application.app_context():
        limiter.reset()
        yield application.test_client()
        limiter.reset()
        limiter.enabled = False


@pytest.fixture
def account(app: Flask) -> Iterator[User]:
    with app.app_context():
        role = Role(key=RoleKey.CLUB_ADMIN, label="Club Admin")
        user = User(email="admin@example.com", full_name="Club Admin")
        user.set_password(PASSWORD)
        user.roles.append(role)
        db.session.add_all([role, user])
        db.session.commit()
        yield user


def _attempt(client: FlaskClient, ip: str, password: str = "wrong") -> int:  # noqa: S107
    return client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": password},
        headers={"True-Client-IP": ip},
    ).status_code


# ---------------------------------------------------------------- storage


def test_database_counters_add_up_and_restart_with_a_new_window(app: Flask) -> None:
    storage = DatabaseStorage()
    with app.app_context():
        assert storage.get("k") == 0
        assert storage.incr("k", 60) == 1
        assert storage.incr("k", 60, amount=2) == 3
        assert storage.get("k") == 3
        assert time.time() < storage.get_expiry("k") <= time.time() + 61

        # Once the window has passed the old hits no longer count.
        db.session.execute(
            update(RateLimitCounter).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        db.session.commit()
        assert storage.get("k") == 0
        assert storage.incr("k", 60) == 1

        storage.clear("k")
        assert storage.get("k") == 0
        storage.incr("a", 60)
        storage.incr("b", 60)
        assert storage.reset() == 2
        assert storage.check() is True


def test_production_refuses_per_process_rate_limit_counters() -> None:
    with pytest.raises(ValidationError, match="RATELIMIT_STORAGE"):
        Settings(
            _env_file=None,
            APP_ENV="production",
            SECRET_KEY="k7Qm2vX9pL4rT8wZ1nB6yH3jF5dS0aGe",
            JWT_SECRET_KEY="R4tY8uI2oP6aS0dF3gH7jK1lZ5xC9vBn",
            DATABASE_URL="postgresql+psycopg://user:pw@host:5432/db",
            CORS_ORIGINS="https://example.com",
            JWT_COOKIE_SECURE=True,
            MEDIA_BACKEND="cloudinary",
            CLOUDINARY_CLOUD_NAME="c",
            CLOUDINARY_API_KEY="k",
            CLOUDINARY_API_SECRET="s",
            RATELIMIT_STORAGE="memory",
        )


def test_the_client_address_header_is_trusted_only_in_production() -> None:
    assert _settings().trust_client_ip_header is False
    assert _settings(TRUST_CLIENT_IP_HEADER=True).trust_client_ip_header is True


# ---------------------------------------------------------------- per visitor


def test_one_visitor_hitting_the_limit_does_not_lock_out_another(
    behind_cloudflare: FlaskClient, account: User
) -> None:
    first = [_attempt(behind_cloudflare, "203.0.113.7") for _ in range(6)]
    assert first[-1] == 429

    # Before this change every visitor shared the proxy's address, so one
    # person guessing locked the whole club out of signing in.
    assert _attempt(behind_cloudflare, "198.51.100.20", PASSWORD) == 200


def test_a_forged_forwarded_for_header_does_not_dodge_the_limit(
    behind_cloudflare: FlaskClient, account: User
) -> None:
    statuses = [
        behind_cloudflare.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong"},
            headers={"True-Client-IP": "203.0.113.7", "X-Forwarded-For": f"10.0.0.{n}"},
        ).status_code
        for n in range(6)
    ]
    assert statuses[-1] == 429


def test_a_garbage_client_address_header_is_ignored(
    behind_cloudflare: FlaskClient, account: User
) -> None:
    statuses = [_attempt(behind_cloudflare, f"not-an-ip-{n}") for n in range(6)]
    # Every request falls back to the socket address, so they share a limit.
    assert statuses[-1] == 429


# ---------------------------------------------------------------- per account


def test_guesses_spread_across_many_addresses_still_hit_the_account_limit(
    behind_cloudflare: FlaskClient, account: User
) -> None:
    statuses = [_attempt(behind_cloudflare, f"203.0.113.{n}") for n in range(1, 12)]

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


def test_successful_sign_ins_never_count_against_the_account(
    behind_cloudflare: FlaskClient, account: User
) -> None:
    for n in range(1, 13):
        assert _attempt(behind_cloudflare, f"198.51.100.{n}", PASSWORD) == 200


def test_an_unknown_address_costs_the_same_work_as_a_real_one(
    client: FlaskClient, account: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    burned: list[str] = []
    monkeypatch.setattr(passwords, "burn_verification", burned.append)
    monkeypatch.setattr("app.api.v1.auth.burn_verification", burned.append)

    response = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "guess"}
    )

    assert response.status_code == 401
    assert burned == ["guess"]


def test_the_dummy_check_never_lets_anyone_in() -> None:
    passwords.burn_verification("anything")  # must not raise, must not matter
    assert passwords._dummy_hash is not None
    assert not passwords.verify_password(passwords._dummy_hash, "anything")


# ---------------------------------------------------------------- sessions


def test_changing_your_password_signs_out_every_other_session(
    client: FlaskClient, account: User
) -> None:
    def sign_in(password: str) -> dict[str, str]:
        body = client.post(
            "/api/v1/auth/login", json={"email": "admin@example.com", "password": password}
        ).get_json()
        return {"Authorization": f"Bearer {body['access_token']}"}

    laptop = sign_in(PASSWORD)
    phone = sign_in(PASSWORD)

    changed = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "an-entirely-new-password"},
        headers=laptop,
    )
    assert changed.status_code == 200

    assert client.get("/api/v1/auth/me", headers=phone).status_code == 401
    assert client.get("/api/v1/auth/me", headers=laptop).status_code == 401
    renewed = sign_in("an-entirely-new-password")
    assert client.get("/api/v1/auth/me", headers=renewed).status_code == 200


def test_an_old_hash_upgraded_at_sign_in_does_not_end_that_session(
    client: FlaskClient, account: User, app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.api.v1.auth.needs_rehash", lambda _hash: True)

    body = client.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": PASSWORD}
    ).get_json()

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    with app.app_context():
        assert db.session.get(User, account.id).session_version == 0


# ---------------------------------------------------------------- headers


def test_api_responses_cannot_be_framed_sniffed_or_run(client: FlaskClient) -> None:
    response = client.get("/api/v1/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Referrer-Policy"] == "no-referrer"
    # Never outside production: it would pin a developer's localhost to HTTPS.
    assert "Strict-Transport-Security" not in response.headers


def test_migrations_run_at_startup_only_where_nothing_else_runs_them() -> None:
    assert _settings().auto_migrate is False
    assert _settings(AUTO_MIGRATE=True).auto_migrate is True
