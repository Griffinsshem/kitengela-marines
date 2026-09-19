"""Offset pagination for public collections.

Every collection endpoint returns the same {"data": [...], "meta": {...}}
envelope, so the frontend has one shape to handle rather than one per route.
per_page is capped server-side: an unbounded page size is a free way for anyone
to ask the club's small Render instance to serialise the entire archive.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from flask import request
from sqlalchemy import Select, func, select

from app.extensions import db
from app.utils.errors import ApiError

DEFAULT_PER_PAGE = 20
MAX_PER_PAGE = 100


def _positive_int(name: str, default: int) -> int:
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ApiError(f"{name} must be an integer.", status_code=400) from error
    if value < 1:
        raise ApiError(f"{name} must be at least 1.", status_code=400)
    return value


def paginate(stmt: Select[Any], serializer: Callable[[Any], dict[str, Any]]) -> dict[str, Any]:
    page = _positive_int("page", 1)
    per_page = min(_positive_int("per_page", DEFAULT_PER_PAGE), MAX_PER_PAGE)

    # order_by(None) because ordering is irrelevant to a count and PostgreSQL
    # rejects ORDER BY over a column the subquery does not select.
    total = db.session.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    rows = db.session.scalars(stmt.limit(per_page).offset((page - 1) * per_page)).unique().all()

    return {
        "data": [serializer(row) for row in rows],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page,
        },
    }
