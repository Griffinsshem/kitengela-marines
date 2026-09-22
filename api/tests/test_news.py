from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import Article, ArticleStatus, AuditLog, Role, RoleKey, TeamGender, User
from app.utils.sanitize import sanitize_html
from tests import factories

PASSWORD = "a-sufficiently-long-password"


@pytest.fixture
def roles(app: Flask) -> Iterator[dict[RoleKey, Role]]:
    keys = (RoleKey.CLUB_ADMIN, RoleKey.MEDIA_OFFICER, RoleKey.TEAM_MANAGER)
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
def media(session: object, client: FlaskClient, roles: dict[RoleKey, Role]) -> dict[str, str]:
    make_user("media@example.com", RoleKey.MEDIA_OFFICER)
    return auth(client, "media@example.com")


def draft_body(category: Any, **overrides: Any) -> dict[str, Any]:
    body = {
        "title": "Pre-season update",
        "category_id": str(category.id),
        "body_html": "<p>Training resumes.</p>",
    }
    body.update(overrides)
    return body


# --- sanitiser -------------------------------------------------------------


@pytest.mark.parametrize(
    "payload",
    [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        '<a href="javascript:alert(1)">x</a>',
        '<a href="jav&#x09;ascript:alert(1)">x</a>',
        "<svg><script>alert(1)</script></svg>",
        '<iframe src="https://evil.example"></iframe>',
        '<p style="background:url(javascript:alert(1))">x</p>',
    ],
)
def test_sanitiser_removes_executable_content(payload: str) -> None:
    cleaned = sanitize_html(payload).lower()
    for marker in ("<script", "onerror", "javascript:", "<iframe", "<svg", "style="):
        assert marker not in cleaned


def test_sanitiser_keeps_formatting_and_hardens_links() -> None:
    cleaned = sanitize_html(
        '<h2>Report</h2><p><strong>Win</strong> <a href="https://example.com">link</a></p>'
    )
    assert "<h2>Report</h2>" in cleaned
    assert "<strong>Win</strong>" in cleaned
    assert 'rel="noopener noreferrer nofollow"' in cleaned


# --- drafting --------------------------------------------------------------


def test_media_officer_drafts_with_a_sanitised_body(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    category = factories.article_category()
    db.session.commit()

    response = client.post(
        "/api/v1/admin/articles",
        json=draft_body(category, body_html="<p>Hi</p><script>alert(1)</script>"),
        headers=media,
    )

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["status"] == "draft"
    assert data["body_html"] == "<p>Hi</p>"
    # The author comes from the token, not from anything the client sent.
    assert data["author"] == "Test User"
    assert data["slug"] == "pre-season-update"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("author_id", "00000000-0000-0000-0000-000000000001"),
        ("status", "published"),
        ("slug", "chosen-by-client"),
    ],
)
def test_client_cannot_set_author_status_or_slug(
    session: object, client: FlaskClient, media: dict[str, str], field: str, value: str
) -> None:
    category = factories.article_category()
    db.session.commit()

    response = client.post(
        "/api/v1/admin/articles", json=draft_body(category, **{field: value}), headers=media
    )

    assert response.status_code == 422
    assert db.session.query(Article).count() == 0


def test_title_cannot_be_patched_to_null(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    article = factories.article(factories.article_category())
    db.session.commit()

    response = client.patch(
        f"/api/v1/admin/articles/{article.id}", json={"title": None}, headers=media
    )

    assert response.status_code == 422


# --- publishing ------------------------------------------------------------


def test_drafts_are_invisible_to_the_public(session: object, client: FlaskClient) -> None:
    factories.article(factories.article_category(), slug="secret-draft")
    db.session.commit()

    assert client.get("/api/v1/articles").get_json()["data"] == []
    # Same 404 as a slug that never existed.
    assert client.get("/api/v1/articles/secret-draft").status_code == 404


def test_publishing_makes_an_article_public_and_is_audited(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    article = factories.article(factories.article_category(), slug="big-win")
    db.session.commit()

    response = client.post(f"/api/v1/admin/articles/{article.id}/publish", json={}, headers=media)

    assert response.status_code == 200
    listed = client.get("/api/v1/articles").get_json()["data"]
    assert [a["slug"] for a in listed] == ["big-win"]
    assert client.get("/api/v1/articles/big-win").status_code == 200
    assert db.session.query(AuditLog).filter_by(action="article.published").count() == 1


def test_scheduled_article_stays_hidden_until_its_time(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    article = factories.article(factories.article_category(), slug="match-day")
    db.session.commit()

    future = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    client.post(
        f"/api/v1/admin/articles/{article.id}/publish",
        json={"published_at": future},
        headers=media,
    )

    assert client.get("/api/v1/articles").get_json()["data"] == []
    assert client.get("/api/v1/articles/match-day").status_code == 404
    assert db.session.query(AuditLog).filter_by(action="article.scheduled").count() == 1

    # Time passes.
    db.session.refresh(article)
    article.published_at = datetime.now(UTC) - timedelta(minutes=1)
    db.session.commit()

    assert client.get("/api/v1/articles/match-day").status_code == 200


def test_publish_time_without_a_timezone_is_rejected(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    article = factories.article(factories.article_category())
    db.session.commit()

    response = client.post(
        f"/api/v1/admin/articles/{article.id}/publish",
        json={"published_at": "2026-10-03T15:00:00"},
        headers=media,
    )

    assert response.status_code == 422
    db.session.refresh(article)
    assert article.status == ArticleStatus.DRAFT


def test_an_empty_article_cannot_be_published(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    article = factories.article(factories.article_category(), body_html="")
    db.session.commit()

    response = client.post(f"/api/v1/admin/articles/{article.id}/publish", json={}, headers=media)

    assert response.status_code == 422


@pytest.mark.rbac
def test_team_manager_cannot_write_or_publish_news(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    category = factories.article_category()
    article = factories.article(category)
    db.session.commit()
    headers = auth(client, "manager@example.com")

    created = client.post("/api/v1/admin/articles", json=draft_body(category), headers=headers)
    published = client.post(
        f"/api/v1/admin/articles/{article.id}/publish", json={}, headers=headers
    )

    assert created.status_code == 403
    assert published.status_code == 403


def test_live_article_must_be_unpublished_before_deletion(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    article = factories.article(
        factories.article_category(),
        status=ArticleStatus.PUBLISHED,
        published_at=datetime.now(UTC),
    )
    db.session.commit()
    path = f"/api/v1/admin/articles/{article.id}"

    assert client.delete(path, headers=media).status_code == 409
    assert client.post(f"{path}/unpublish", json={}, headers=media).status_code == 200
    assert client.delete(path, headers=media).status_code == 200
    assert db.session.query(Article).count() == 0


# --- reading ---------------------------------------------------------------


def test_articles_filter_by_team_and_category(session: object, client: FlaskClient) -> None:
    starlets = factories.team("starlets", gender=TeamGender.WOMEN)
    news = factories.article_category("Club News")
    reports = factories.article_category("Match Reports")
    now = datetime.now(UTC)
    factories.article(news, title="Club update", status=ArticleStatus.PUBLISHED, published_at=now)
    factories.article(
        reports,
        title="Starlets win",
        team_id=starlets.id,
        status=ArticleStatus.PUBLISHED,
        published_at=now,
    )
    db.session.commit()

    by_team = client.get("/api/v1/articles?team=starlets").get_json()["data"]
    by_category = client.get("/api/v1/articles?category=club-news").get_json()["data"]

    assert [a["slug"] for a in by_team] == ["starlets-win"]
    assert [a["slug"] for a in by_category] == ["club-update"]


def test_stored_html_is_sanitised_again_on_read(session: object, client: FlaskClient) -> None:
    # Content that reached the database some other way, or before a tightening
    # of the allow-list, is still cleaned before any browser sees it.
    factories.article(
        factories.article_category(),
        slug="legacy",
        body_html="<p>ok</p><img src=x onerror=alert(1)>",
        status=ArticleStatus.PUBLISHED,
        published_at=datetime.now(UTC),
    )
    db.session.commit()

    body = client.get("/api/v1/articles/legacy").get_json()["data"]["body_html"]

    assert body == "<p>ok</p>"
