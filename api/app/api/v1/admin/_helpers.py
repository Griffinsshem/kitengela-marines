"""Shared plumbing for administrative writes."""

from __future__ import annotations

import uuid
from typing import Any, NoReturn

from flask import request
from pydantic import BaseModel, ValidationError

from app.extensions import db
from app.utils.errors import ApiError


def not_found(message: str) -> NoReturn:
    raise ApiError(message, status_code=404, code="not_found")


def conflict(message: str) -> NoReturn:
    raise ApiError(message, status_code=409, code="conflict")


def parse_body[ModelT: BaseModel](schema: type[ModelT]) -> ModelT:
    """Validate the request body against a schema.

    The schema names every acceptable field and forbids the rest, so this is
    where mass assignment is stopped: a field the schema does not declare never
    reaches a model attribute.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("A JSON object body is required.", status_code=400)
    return schema.model_validate(body)


def parse_uuid(value: str, label: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError) as error:
        raise ApiError(f"Invalid {label}.", status_code=400) from error


def apply_changes(instance: object, payload: BaseModel) -> list[str]:
    """Assign only the fields the client actually sent.

    exclude_unset distinguishes "omitted" from "explicitly set to null", so a
    PATCH that mentions three fields cannot silently blank the other twenty.
    Returns the changed field names for the audit log in 8C.
    """
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(instance, field, value)
    return sorted(changes)


def commit_or_conflict(message: str) -> None:
    """Commit, converting a constraint violation into a 409.

    Uniqueness is enforced by the database, not by a pre-flight SELECT, which
    would leave a race between the check and the insert.
    """
    from sqlalchemy.exc import IntegrityError

    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        raise ApiError(message, status_code=409, code="conflict") from error


def validation_error(field: str, message: str) -> NoReturn:
    """Raise a 422 shaped like a pydantic failure, for checks needing the database."""
    raise ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def unused(*_args: Any) -> None:
    """Placeholder to keep imports honest in stubs."""
    return None


__all__ = [
    "ValidationError",
    "apply_changes",
    "commit_or_conflict",
    "conflict",
    "not_found",
    "parse_body",
    "parse_uuid",
    "validation_error",
]
