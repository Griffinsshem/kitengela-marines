from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.extensions import db
from app.models import (
    Article,
    ArticleStatus,
    Gallery,
    GalleryItem,
    MediaAsset,
    Role,
    RoleKey,
    User,
    Video,
)
from app.schemas.public import serialize_gallery
from app.utils.video import parse_youtube_id
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


# --- YouTube parsing -------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
        "dQw4w9WgXcQ",
    ],
)
def test_youtube_links_yield_the_video_id(value: str) -> None:
    assert parse_youtube_id(value) == "dQw4w9WgXcQ"


@pytest.mark.parametrize(
    "value",
    [
        "https://evil.example/embed/dQw4w9WgXcQ",
        "javascript:alert(1)",
        "https://www.youtube.com/watch?v=short",
        "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
        "",
    ],
)
def test_non_youtube_links_are_refused(value: str) -> None:
    assert parse_youtube_id(value) is None


def test_video_payload_only_ever_points_at_youtube(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/admin/videos",
        json={
            "title": "Marines v Rivals highlights",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
            "is_published": True,
        },
        headers=media,
    )

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["youtube_id"] == "dQw4w9WgXcQ"
    assert data["thumbnail_url"].startswith("https://i.ytimg.com/")
    assert data["embed_url"].startswith("https://www.youtube-nocookie.com/embed/")


def test_a_non_youtube_video_link_is_rejected(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/admin/videos",
        json={"title": "Not a video", "youtube_url": "https://evil.example/embed/x"},
        headers=media,
    )

    assert response.status_code == 422
    assert db.session.query(Video).count() == 0


# --- galleries -------------------------------------------------------------


def test_unpublished_galleries_are_invisible(session: object, client: FlaskClient) -> None:
    factories.gallery(slug="training-day")
    db.session.commit()

    assert client.get("/api/v1/galleries").get_json()["data"] == []
    assert client.get("/api/v1/galleries/training-day").status_code == 404


def test_photos_are_replaced_in_order(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery(is_published=True)
    first, second, third = (factories.media_asset(alt_text=f"Photo {n}") for n in (1, 2, 3))
    db.session.commit()
    path = f"/api/v1/admin/galleries/{gallery.id}/photos"

    client.put(
        path,
        json={
            "photos": [
                {"asset_id": str(first.id)},
                {"asset_id": str(second.id), "caption": "Second"},
                {"asset_id": str(third.id)},
            ]
        },
        headers=media,
    )

    # Reordered and trimmed in one request.
    client.put(
        path,
        json={"photos": [{"asset_id": str(third.id)}, {"asset_id": str(first.id)}]},
        headers=media,
    )

    photos = client.get(f"/api/v1/galleries/{gallery.slug}").get_json()["data"]["photos"]
    assert [photo["alt"] for photo in photos] == ["Photo 3", "Photo 1"]
    assert db.session.query(GalleryItem).count() == 2


def test_a_photo_cannot_appear_twice_in_one_gallery(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery()
    asset = factories.media_asset()
    db.session.commit()

    response = client.put(
        f"/api/v1/admin/galleries/{gallery.id}/photos",
        json={"photos": [{"asset_id": str(asset.id)}, {"asset_id": str(asset.id)}]},
        headers=media,
    )

    assert response.status_code == 422


def test_gallery_caption_overrides_the_asset_caption(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery(is_published=True)
    asset = factories.media_asset(caption="Library caption")
    db.session.commit()

    client.put(
        f"/api/v1/admin/galleries/{gallery.id}/photos",
        json={"photos": [{"asset_id": str(asset.id), "caption": "In this gallery"}]},
        headers=media,
    )

    photo = client.get(f"/api/v1/galleries/{gallery.slug}").get_json()["data"]["photos"][0]
    assert photo["caption"] == "In this gallery"


def test_gallery_falls_back_to_its_first_photo_for_a_cover(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery(is_published=True)
    asset = factories.media_asset(alt_text="Opening photo")
    factories.gallery_item(gallery, asset)
    db.session.commit()

    summary = client.get("/api/v1/galleries").get_json()["data"][0]

    assert summary["cover"]["alt"] == "Opening photo"
    assert summary["photo_count"] == 1


@pytest.mark.rbac
def test_team_manager_cannot_manage_galleries(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    headers = auth(client, "manager@example.com")

    response = client.post("/api/v1/admin/galleries", json={"title": "Match day"}, headers=headers)

    assert response.status_code == 403
    assert db.session.query(Gallery).count() == 0


# --- the in-use guard ------------------------------------------------------


def _delete_asset(client: FlaskClient, headers: dict[str, str], asset: MediaAsset) -> Any:
    return client.delete(f"/api/v1/admin/media/assets/{asset.id}", headers=headers)


def test_a_photo_in_a_gallery_cannot_be_deleted(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery()
    asset = factories.media_asset()
    factories.gallery_item(gallery, asset)
    db.session.commit()

    blocked = _delete_asset(client, media, asset)
    assert blocked.status_code == 409
    assert "gallery" in blocked.get_json()["error"]["message"]

    # Removed from the gallery, it can go.
    client.put(f"/api/v1/admin/galleries/{gallery.id}/photos", json={"photos": []}, headers=media)
    assert _delete_asset(client, media, asset).status_code == 200


def test_a_gallery_cover_cannot_be_deleted(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    asset = factories.media_asset()
    factories.gallery(cover_asset_id=asset.id)
    db.session.commit()

    assert _delete_asset(client, media, asset).status_code == 409


def test_an_articles_featured_image_cannot_be_deleted(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    asset = factories.media_asset()
    factories.article(factories.article_category(), featured_image_id=asset.id)
    db.session.commit()

    blocked = _delete_asset(client, media, asset)

    assert blocked.status_code == 409
    assert "article" in blocked.get_json()["error"]["message"]


def test_deleting_a_gallery_keeps_the_photographs(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery()
    asset = factories.media_asset()
    factories.gallery_item(gallery, asset)
    db.session.commit()

    response = client.delete(f"/api/v1/admin/galleries/{gallery.id}", headers=media)

    assert response.status_code == 200
    assert db.session.query(GalleryItem).count() == 0
    # The photo stays in the library; it may be used elsewhere.
    assert db.session.query(MediaAsset).count() == 1


# --- featured images -------------------------------------------------------


def test_a_featured_image_reaches_the_public_article(session: object, client: FlaskClient) -> None:
    from datetime import UTC, datetime

    asset = factories.media_asset(alt_text="Captain lifts the trophy")
    factories.article(
        factories.article_category(),
        slug="a-good-day",
        featured_image_id=asset.id,
        status=ArticleStatus.PUBLISHED,
        published_at=datetime.now(UTC),
    )
    db.session.commit()

    data = client.get("/api/v1/articles/a-good-day").get_json()["data"]

    assert data["featured_image"]["alt"] == "Captain lifts the trophy"
    assert db.session.query(Article).count() == 1


def test_admin_gallery_carries_asset_ids_for_the_editor(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    gallery = factories.gallery()
    asset = factories.media_asset(alt_text="Squad before kick-off")
    factories.gallery_item(gallery, asset)
    db.session.commit()

    response = client.get(f"/api/v1/admin/galleries/{gallery.id}", headers=media)

    assert response.status_code == 200
    photo = response.get_json()["data"]["photos"][0]
    assert photo["asset_id"] == str(asset.id)
    # The public payload stays as it was: what a page renders, nothing more.
    assert "asset_id" not in serialize_gallery(gallery)["photos"][0]
