from __future__ import annotations

from collections.abc import Iterator
from io import BytesIO
from pathlib import Path
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient
from PIL import Image
from pydantic import ValidationError

from app.config import Settings
from app.extensions import db
from app.models import AuditLog, MediaAsset, Role, RoleKey, User
from app.services import images as images_module

PASSWORD = "a-sufficiently-long-password"
GPS_TAG = 34853


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


def jpeg_bytes(
    size: tuple[int, int] = (1200, 800), *, gps: bool = False, orientation: int | None = None
) -> bytes:
    image = Image.new("RGB", size, (20, 120, 60))
    buffer, options = BytesIO(), {}
    if gps or orientation:
        exif = Image.Exif()
        if orientation:
            exif[274] = orientation
        if gps:
            exif[271] = "TestPhone"
            exif[GPS_TAG] = {1: "S", 2: (1.0, 21.0, 0.0), 3: "E", 4: (36.0, 52.0, 0.0)}
        options["exif"] = exif.tobytes()
    image.save(buffer, format="JPEG", **options)
    return buffer.getvalue()


def png_bytes(size: tuple[int, int] = (40, 40)) -> bytes:
    buffer = BytesIO()
    Image.new("RGBA", size, (255, 0, 0, 128)).save(buffer, format="PNG")
    return buffer.getvalue()


def upload(
    client: FlaskClient,
    headers: dict[str, str],
    data: bytes,
    *,
    filename: str = "photo.jpg",
    alt_text: str | None = "Squad before kick-off",
    **extra: Any,
) -> Any:
    payload: dict[str, Any] = {"file": (BytesIO(data), filename)}
    if alt_text is not None:
        payload["alt_text"] = alt_text
    payload.update(extra)
    return client.post(
        "/api/v1/admin/media/uploads",
        data=payload,
        headers=headers,
        content_type="multipart/form-data",
    )


def stored_file(app: Flask, asset: MediaAsset) -> Path:
    return Path(app.extensions["settings"].MEDIA_LOCAL_DIR) / asset.storage_key


def test_upload_stores_a_normalised_copy(
    session: object, app: Flask, client: FlaskClient, media: dict[str, str]
) -> None:
    response = upload(client, media, jpeg_bytes(size=(4000, 3000)))

    assert response.status_code == 201
    data = response.get_json()["data"]
    # Capped at the long-edge limit rather than stored at 4000px.
    assert (data["width"], data["height"]) == (2560, 1920)
    assert data["alt"] == "Squad before kick-off"

    asset = db.session.query(MediaAsset).one()
    assert stored_file(app, asset).exists()
    assert asset.url.endswith(asset.storage_key)


def test_location_metadata_is_stripped(
    session: object, app: Flask, client: FlaskClient, media: dict[str, str]
) -> None:
    upload(client, media, jpeg_bytes(gps=True))

    asset = db.session.query(MediaAsset).one()
    with Image.open(stored_file(app, asset)) as stored:
        exif = stored.getexif()

    # No GPS coordinates and no camera make reach the published file.
    assert GPS_TAG not in exif
    assert len(exif) == 0


def test_orientation_is_applied_before_metadata_is_discarded(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    response = upload(client, media, jpeg_bytes(size=(1200, 800), orientation=6))

    data = response.get_json()["data"]
    # Rotated to portrait, rather than left sideways once the flag is gone.
    assert (data["width"], data["height"]) == (800, 1200)


def test_type_is_decided_by_content_not_filename(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    accepted = upload(client, media, png_bytes(), filename="notes.txt")
    rejected = upload(client, media, b"<?php system($_GET['c']); ?>", filename="photo.jpg")

    assert accepted.status_code == 201
    assert accepted.get_json()["data"]["content_type"] == "image/png"
    assert rejected.status_code == 422
    assert db.session.query(MediaAsset).count() == 1


@pytest.mark.parametrize(
    ("payload", "filename"),
    [
        (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "logo.svg"),
        (b"", "empty.jpg"),
    ],
)
def test_non_image_uploads_are_rejected(
    session: object, client: FlaskClient, media: dict[str, str], payload: bytes, filename: str
) -> None:
    response = upload(client, media, payload, filename=filename)

    assert response.status_code == 422
    assert db.session.query(MediaAsset).count() == 0


@pytest.mark.parametrize("alt_text", [None, "   "])
def test_alt_text_is_required(
    session: object, client: FlaskClient, media: dict[str, str], alt_text: str | None
) -> None:
    response = upload(client, media, jpeg_bytes(), alt_text=alt_text)

    assert response.status_code == 422
    assert db.session.query(MediaAsset).count() == 0


def test_oversized_dimensions_are_refused_before_decoding(
    session: object,
    client: FlaskClient,
    media: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Stands in for a decompression bomb without allocating one in the test.
    monkeypatch.setattr(images_module, "MAX_PIXELS", 100)

    response = upload(client, media, jpeg_bytes(size=(200, 200)))

    assert response.status_code == 422
    assert db.session.query(MediaAsset).count() == 0


@pytest.mark.rbac
def test_team_manager_cannot_upload(
    session: object, client: FlaskClient, roles: dict[RoleKey, Role]
) -> None:
    make_user("manager@example.com", RoleKey.TEAM_MANAGER)
    headers = auth(client, "manager@example.com")

    assert upload(client, headers, jpeg_bytes()).status_code == 403
    assert db.session.query(MediaAsset).count() == 0


def test_upload_is_audited_with_the_uploader(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    upload(client, media, jpeg_bytes())

    entry = db.session.query(AuditLog).filter_by(action="media.uploaded").one()
    assert entry.actor_email == "media@example.com"


def test_alt_text_and_caption_can_be_corrected(
    session: object, client: FlaskClient, media: dict[str, str]
) -> None:
    asset_id = upload(client, media, jpeg_bytes()).get_json()["data"]["id"]

    response = client.patch(
        f"/api/v1/admin/media/assets/{asset_id}",
        json={"alt_text": "Starting eleven at Kitengela", "caption": "Before kick-off"},
        headers=media,
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["alt"] == "Starting eleven at Kitengela"


def test_deleting_an_asset_removes_the_stored_file(
    session: object, app: Flask, client: FlaskClient, media: dict[str, str]
) -> None:
    asset_id = upload(client, media, jpeg_bytes()).get_json()["data"]["id"]
    asset = db.session.query(MediaAsset).one()
    path = stored_file(app, asset)
    assert path.exists()

    response = client.delete(f"/api/v1/admin/media/assets/{asset_id}", headers=media)

    assert response.status_code == 200
    assert not path.exists()
    assert db.session.query(MediaAsset).count() == 0


def test_production_refuses_local_media_storage() -> None:
    # Render replaces its disk on every deploy, so this combination would lose
    # every photo the club has uploaded.
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            APP_ENV="production",
            SECRET_KEY="a-long-production-secret-key-value-here-ok",
            JWT_SECRET_KEY="a-different-long-production-jwt-key-value",
            DATABASE_URL="postgresql+psycopg://user:pass@host:5432/db",
            CORS_ORIGINS="https://example.com",
            JWT_COOKIE_SECURE=True,
            MEDIA_BACKEND="local",
        )
