from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from flask import Response, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    set_refresh_cookies,
    unset_jwt_cookies,
    verify_jwt_in_request,
)

from app.api.v1 import api_v1
from app.extensions import db, limiter
from app.models.identity import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest
from app.security.authorization import (
    AuthenticationError,
    authenticated,
    current_user,
    load_current_user,
    serialize_user,
)
from app.security.passwords import needs_rehash
from app.utils.errors import ApiError


def _json_body() -> dict[str, Any]:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("A JSON object body is required.", status_code=400)
    return body


@api_v1.post("/auth/login")
@limiter.limit("5 per minute; 20 per hour")
def login() -> tuple[Response, int]:
    payload = LoginRequest.model_validate(_json_body())

    user = db.session.query(User).filter_by(email=payload.email.lower()).first()

    if user is None or not user.is_active or not user.check_password(payload.password):
        raise AuthenticationError("Incorrect email or password.")

    if needs_rehash(user.password_hash):
        user.set_password(payload.password)

    user.last_login_at = datetime.now(UTC)
    db.session.commit()

    identity = str(user.id)
    response = jsonify(
        {
            "access_token": create_access_token(identity=identity),
            "user": serialize_user(user),
        }
    )
    set_refresh_cookies(response, create_refresh_token(identity=identity))
    return response, 200


@api_v1.post("/auth/refresh")
@limiter.limit("30 per hour")
def refresh() -> tuple[Response, int]:
    verify_jwt_in_request(refresh=True)

    try:
        user_id = uuid.UUID(str(get_jwt_identity()))
    except (TypeError, ValueError) as error:
        raise AuthenticationError("Invalid credentials.") from error

    user = db.session.get(User, user_id, populate_existing=True)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid credentials.")

    return jsonify({"access_token": create_access_token(identity=str(user.id))}), 200


@api_v1.post("/auth/logout")
def logout() -> tuple[Response, int]:
    """Clear the refresh cookie.

    The access token stays valid until it expires; at fifteen minutes that is
    an acceptable window, and the alternative is a denylist with per-request
    storage cost. Revoke the account to cut access immediately.
    """
    response = jsonify({"status": "ok"})
    unset_jwt_cookies(response)
    return response, 200


@api_v1.get("/auth/me")
@authenticated
def me() -> tuple[Response, int]:
    return jsonify({"user": serialize_user(current_user())}), 200


@api_v1.post("/auth/change-password")
@limiter.limit("5 per hour")
def change_password() -> tuple[Response, int]:
    user = load_current_user()
    payload = ChangePasswordRequest.model_validate(_json_body())

    if not user.check_password(payload.current_password):
        raise AuthenticationError("Incorrect email or password.")

    user.set_password(payload.new_password)
    db.session.commit()

    response = jsonify({"status": "ok"})
    unset_jwt_cookies(response)
    return response, 200
