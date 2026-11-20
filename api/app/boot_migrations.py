"""Apply pending database migrations when the API starts.

Render's pre-deploy command is a paid feature, and the free plan's start
command cannot be relied on to run anything first, so a deploy whose code
needs a new column would otherwise go live against a database that lacks it.
Running `flask db upgrade` by hand before every push works until the one time
it is forgotten. This makes the deploy itself bring the schema up to date.

Both gunicorn workers import the app, so both arrive here. A PostgreSQL
advisory lock lets exactly one migrate at a time; the other waits, then finds
nothing left to do. If a migration fails the worker does not start, so Render
keeps the previous deploy serving instead of running new code on an old schema.
"""

from __future__ import annotations

import logging
from pathlib import Path

from flask import Flask
from flask_migrate import upgrade
from sqlalchemy import text

from app.extensions import db

logger = logging.getLogger(__name__)

# Any fixed 64-bit number; it only has to be the same in every worker.
_LOCK_ID = 7_420_031_119
_MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"


def apply_pending_migrations(app: Flask) -> None:
    with app.app_context(), db.engine.connect() as lock_connection:
        lock_connection.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _LOCK_ID})
        try:
            loggers_before = {
                name: log.disabled
                for name, log in logging.root.manager.loggerDict.items()
                if isinstance(log, logging.Logger)
            }
            upgrade(directory=str(_MIGRATIONS))
        finally:
            lock_connection.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _LOCK_ID})
            lock_connection.commit()
            # Alembic's env.py calls logging.config.fileConfig, which disables
            # every logger that existed before it. Put the app's back.
            for name, was_disabled in loggers_before.items():
                existing = logging.root.manager.loggerDict.get(name)
                if isinstance(existing, logging.Logger):
                    existing.disabled = was_disabled
    logger.info("Database schema is up to date.")
