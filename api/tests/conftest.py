from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app import create_app
from app.config import Settings
from app.extensions import db

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://marines:marines@localhost:5432/marines_test",
)


@pytest.fixture(scope="session")
def app() -> Iterator[Flask]:
    settings = Settings(
        _env_file=None,
        APP_ENV="development",
        SECRET_KEY="test-only-secret-key",
        JWT_SECRET_KEY="test-only-jwt-secret-key",
        DATABASE_URL=TEST_DATABASE_URL,
        JWT_COOKIE_SECURE=False,
        CORS_ORIGINS="http://localhost:3000",
    )
    application = create_app(settings)

    with application.app_context():
        db.drop_all()
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def _reset_database(app: Flask) -> Iterator[None]:
    yield
    with app.app_context():
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        db.session.commit()


@pytest.fixture
def session(app: Flask) -> Iterator[object]:
    with app.app_context():
        yield db.session


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()
