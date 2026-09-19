from __future__ import annotations

import logging
import sys
from datetime import timedelta

from flask import Flask

from app.api.v1 import api_v1
from app.cli import register_cli
from app.config import Settings, get_settings
from app.extensions import cors, db, jwt, limiter, migrate
from app.utils.errors import register_error_handlers


def _configure_logging(settings: Settings) -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=logging.INFO if settings.is_production else logging.DEBUG,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def create_app(settings: Settings | None = None) -> Flask:
    settings = settings or get_settings()
    _configure_logging(settings)

    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=settings.SECRET_KEY,
        SQLALCHEMY_DATABASE_URI=settings.DATABASE_URL,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "pool_recycle": 300},
        JWT_SECRET_KEY=settings.JWT_SECRET_KEY,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=settings.JWT_ACCESS_TOKEN_MINUTES),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=settings.JWT_REFRESH_TOKEN_DAYS),
        JWT_TOKEN_LOCATION=["headers", "cookies"],
        JWT_COOKIE_SECURE=settings.JWT_COOKIE_SECURE,
        JWT_COOKIE_SAMESITE="None" if settings.is_production else "Lax",
        JWT_COOKIE_CSRF_PROTECT=True,
        JWT_ACCESS_COOKIE_PATH="/api/v1",
        JWT_REFRESH_COOKIE_PATH="/api/v1/auth/refresh",
        RATELIMIT_STORAGE_URI=settings.RATELIMIT_STORAGE_URI,
        RATELIMIT_HEADERS_ENABLED=True,
        RATELIMIT_ENABLED=settings.RATELIMIT_ENABLED,
        MAX_CONTENT_LENGTH=settings.MEDIA_MAX_UPLOAD_MB * 1024 * 1024,
        PROPAGATE_EXCEPTIONS=False,
    )
    app.extensions["settings"] = settings

    db.init_app(app)
    from app import models  # noqa: F401

    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": settings.cors_origin_list}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-CSRF-TOKEN"],
    )

    register_error_handlers(app)
    register_cli(app)
    app.register_blueprint(api_v1)

    return app
