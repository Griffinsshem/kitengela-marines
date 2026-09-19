from __future__ import annotations

import uuid
from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.models.identity import User
from app.security.permissions import (
    CAPABILITY_CAPACITIES,
    TEAM_SCOPED,
    Capability,
    capabilities_for,
)
from app.utils.errors import ApiError


class AuthenticationError(ApiError):
    status_code = 401
    code = "unauthenticated"


class AuthorizationError(ApiError):
    status_code = 403
    code = "forbidden"


def load_current_user() -> User:
    """Resolve the bearer token to a live, active user."""
    verify_jwt_in_request()
    identity = get_jwt_identity()

    try:
        user_id = uuid.UUID(str(identity))
    except (TypeError, ValueError) as error:
        raise AuthenticationError("Invalid credentials.") from error

    # populate_existing forces a re-read rather than returning whatever the
    # session already has cached. A deactivated account must be refused on the
    # very next request, not whenever the identity map happens to be cold.
    user = db.session.get(User, user_id, populate_existing=True)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid credentials.")

    g.current_user = user
    return user


def current_user() -> User:
    user = getattr(g, "current_user", None)
    if user is None:
        raise AuthenticationError("Authentication required.")
    return user


def has_capability(user: User, capability: Capability) -> bool:
    """Role-level check only. Team scope is a separate question."""
    if user.is_club_admin:
        return True
    return capability in capabilities_for(user.role_keys)


def has_team_scope(user: User, capability: Capability, team_id: uuid.UUID) -> bool:
    """Whether the user may exercise this capability against this team."""
    if user.is_club_admin:
        return True
    if capability not in TEAM_SCOPED:
        return True

    capacities = CAPABILITY_CAPACITIES.get(capability, frozenset())
    return team_id in user.team_ids_for(*capacities)


def require_capability(
    capability: Capability,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Authenticate, then check the role-level capability."""

    def decorator[**P, R](view: Callable[P, R]) -> Callable[P, R]:
        @wraps(view)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            user = load_current_user()
            if not has_capability(user, capability):
                raise AuthorizationError("You do not have permission to do that.")
            return view(*args, **kwargs)

        return wrapper

    return decorator


def require_team_scope(user: User, capability: Capability, team_id: uuid.UUID) -> None:
    """Assert team scope, raising the same 403 as a role failure.

    Called inside the view, once the target team is known — a decorator cannot
    see which team a request body refers to.
    """
    if not has_team_scope(user, capability, team_id):
        raise AuthorizationError("You do not have permission to do that.")


def authenticated[**P, R](view: Callable[P, R]) -> Callable[P, R]:
    """Authentication with no capability requirement."""

    @wraps(view)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        load_current_user()
        return view(*args, **kwargs)

    return wrapper


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "roles": sorted(str(key) for key in user.role_keys),
        "capabilities": sorted(str(c) for c in capabilities_for(user.role_keys))
        if not user.is_club_admin
        else sorted(str(c) for c in Capability),
        "teams": [
            {"team_id": str(m.team_id), "capacity": str(m.capacity)}
            for m in user.memberships
            if m.is_active
        ],
    }
