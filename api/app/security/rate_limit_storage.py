"""Rate-limit counters in the application's PostgreSQL database.

Why not the in-memory default: gunicorn runs two worker processes, each with
its own memory, so every limit was quietly doubled; and a Render free instance
sleeps when idle, so every cold start forgave every attempt. A shared Key
Value store would fix both, but this project's free tier has no room for one,
and the database is already here, shared by every worker, and survives
restarts.

Only a handful of endpoints are limited (sign-in, token refresh, the public
forms), so this is one small write per limited request. Each increment is a
single atomic statement, safe with any number of workers.

Registered with the `limits` library under the scheme ``appdb://`` and
selected in `create_app`. Statements run on their own connection, never the
request's session, so a counted attempt stays counted even when the request
itself is rolled back (a failed sign-in, for instance).
"""

from __future__ import annotations

import random
import time

from limits.storage import Storage
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db

# Expired rows are harmless (they are treated as absent) but would otherwise
# pile up. A small share of increments sweeps them; no scheduler needed.
_SWEEP_PROBABILITY = 0.02

_INCREMENT = text(
    """
    INSERT INTO rate_limit_counters (key, hits, expires_at)
    VALUES (:key, :amount, now() + make_interval(secs => :expiry))
    ON CONFLICT (key) DO UPDATE SET
        hits = CASE
            WHEN rate_limit_counters.expires_at <= now() THEN EXCLUDED.hits
            ELSE rate_limit_counters.hits + EXCLUDED.hits
        END,
        expires_at = CASE
            WHEN rate_limit_counters.expires_at <= now() THEN EXCLUDED.expires_at
            ELSE rate_limit_counters.expires_at
        END
    RETURNING hits
    """
)
_GET = text("SELECT hits FROM rate_limit_counters WHERE key = :key AND expires_at > now()")
_EXPIRY = text(
    "SELECT extract(epoch FROM expires_at) FROM rate_limit_counters "
    "WHERE key = :key AND expires_at > now()"
)
_CLEAR = text("DELETE FROM rate_limit_counters WHERE key = :key")
_RESET = text("DELETE FROM rate_limit_counters")
_SWEEP = text("DELETE FROM rate_limit_counters WHERE expires_at <= now()")


class DatabaseStorage(Storage):
    STORAGE_SCHEME = ["appdb"]

    @property
    def base_exceptions(self) -> type[Exception] | tuple[type[Exception], ...]:
        return SQLAlchemyError

    def incr(self, key: str, expiry: int, amount: int = 1) -> int:
        with db.engine.begin() as connection:
            hits = connection.execute(
                _INCREMENT, {"key": key, "amount": amount, "expiry": expiry}
            ).scalar_one()
            if random.random() < _SWEEP_PROBABILITY:  # noqa: S311 - not security sensitive
                connection.execute(_SWEEP)
        return int(hits)

    def get(self, key: str) -> int:
        with db.engine.connect() as connection:
            hits = connection.execute(_GET, {"key": key}).scalar_one_or_none()
        return int(hits or 0)

    def get_expiry(self, key: str) -> float:
        with db.engine.connect() as connection:
            expiry = connection.execute(_EXPIRY, {"key": key}).scalar_one_or_none()
        # No live window: it would start now, as the in-memory storage reports.
        return float(expiry) if expiry is not None else time.time()

    def check(self) -> bool:
        try:
            with db.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return False
        return True

    def reset(self) -> int | None:
        with db.engine.begin() as connection:
            return connection.execute(_RESET).rowcount

    def clear(self, key: str) -> None:
        with db.engine.begin() as connection:
            connection.execute(_CLEAR, {"key": key})
