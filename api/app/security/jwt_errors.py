"""Map Flask-JWT-Extended failures onto the API's error envelope.

Without these callbacks the extension answers in its own {"msg": ...} shape and
names the mechanisms it looked for, which is both inconsistent for clients and
more than a caller needs to know.
"""

from __future__ import annotations

from typing import Any

from flask import Response, jsonify

from app.extensions import jwt


def _unauthenticated(message: str = "Authentication required.") -> tuple[Response, int]:
    return jsonify({"error": {"code": "unauthenticated", "message": message}}), 401


def register_jwt_error_handlers() -> None:
    @jwt.unauthorized_loader
    def missing_token(_reason: str) -> tuple[Response, int]:
        return _unauthenticated()

    @jwt.invalid_token_loader
    def invalid_token(_reason: str) -> tuple[Response, int]:
        return _unauthenticated("Invalid credentials.")

    @jwt.expired_token_loader
    def expired_token(_header: dict[str, Any], _payload: dict[str, Any]) -> tuple[Response, int]:
        # A distinct code so the frontend knows to try the refresh endpoint
        # rather than sending the user back to the login form.
        return jsonify({"error": {"code": "token_expired", "message": "Session expired."}}), 401

    @jwt.revoked_token_loader
    def revoked_token(_header: dict[str, Any], _payload: dict[str, Any]) -> tuple[Response, int]:
        return _unauthenticated("Invalid credentials.")
