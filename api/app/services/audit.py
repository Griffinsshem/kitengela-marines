"""Automatic audit capture.

A before_flush listener inspects the session's pending changes and writes an
AuditLog row for each one touching an audited table. Because it hangs off the
session rather than the route, there is no code path that mutates an audited
record without leaving a trace.

The listener knows what changed but not why, so a route may declare intent with
set_action(); the listener uses that label when present and falls back to a
generic created/updated/deleted verb otherwise.
"""

from __future__ import annotations

import uuid
from typing import Any

from flask import g, has_request_context, request
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.extensions import db
from app.models.audit import AuditLog
from app.models.identity import User

# Tables worth a permanent record. Reads are never audited, and neither are
# the audit rows themselves.
AUDITED: dict[str, str] = {
    "users": "user",
    "roles": "role",
    "team_memberships": "team_membership",
    "teams": "team",
    "clubs": "club",
    "players": "player",
    "staff_members": "staff_member",
    "fixtures": "fixture",
    "league_standings": "league_standing",
    "competitions": "competition",
    "seasons": "season",
    "articles": "article",
    "article_categories": "article_category",
    "media_assets": "media_asset",
    "galleries": "gallery",
    "gallery_items": "gallery_item",
    "videos": "video",
}

# Never recorded, even as a field name that changed.
SENSITIVE_FIELDS = frozenset({"password_hash"})

# Operational bookkeeping. A login stamps last_login_at; recording that as a
# user update would bury real changes under every sign-in.
NOISE_FIELDS = frozenset({"last_login_at", "updated_at", "created_at"})


def set_action(action: str) -> None:
    """Declare the intent of the current request, e.g. 'result.recorded'."""
    if has_request_context():
        g.audit_action = action


def _current_action() -> str | None:
    return getattr(g, "audit_action", None) if has_request_context() else None


def _actor() -> tuple[uuid.UUID | None, str | None]:
    if not has_request_context():
        return None, None
    user = getattr(g, "current_user", None)
    if user is None:
        return None, None
    return user.id, user.email


def _client_ip() -> str | None:
    if not has_request_context():
        return None
    # X-Forwarded-For is set by Render's proxy; the first entry is the client.
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return request.remote_addr


def _label(instance: object) -> str | None:
    for attribute in ("slug", "email", "name", "label"):
        value = getattr(instance, attribute, None)
        if isinstance(value, str):
            return value[:200]
    return None


def _ensure_id(instance: object) -> None:
    """Assign the primary key now rather than at flush.

    The UUID default fires during the flush, but this listener runs before it,
    so a new row would otherwise be recorded with no target_id at all.
    """
    if hasattr(instance, "id") and getattr(instance, "id", None) is None:
        instance.id = uuid.uuid4()


def _changed_fields(instance: object) -> list[str]:
    """Names of modified columns. Values are deliberately not captured.

    Column attributes only: relationship collections change on both sides of a
    link, which would log a spurious 'role updated' every time a user gains a
    role. Relationship changes that matter are recorded as named events.
    """
    state = inspect(instance)
    if state is None:
        return []
    columns = {attribute.key for attribute in state.mapper.column_attrs}
    return sorted(
        attribute.key
        for attribute in state.attrs
        if attribute.key in columns
        and attribute.key not in SENSITIVE_FIELDS
        and attribute.key not in NOISE_FIELDS
        and attribute.history.has_changes()
    )


def _entry(
    instance: object,
    verb: str,
    changed: list[str] | None = None,
    *,
    action: str | None = None,
    label: str | None = None,
) -> AuditLog | None:
    target_type = AUDITED.get(str(getattr(instance, "__tablename__", None)))
    if target_type is None:
        return None

    actor_id, actor_email = _actor()
    target_id = getattr(instance, "id", None)

    return AuditLog(
        actor_id=actor_id,
        actor_email=actor_email,
        # An explicit action wins, then the route's declared intent, then a
        # generic verb.
        action=action or _current_action() or f"{target_type}.{verb}",
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        target_label=label or _label(instance),
        changed_fields=changed or None,
        ip_address=_client_ip(),
    )


def _role_changes(user: User) -> list[AuditLog | None]:
    """Role grants and revocations.

    user_roles is a bare association table, not a mapped class, so it never
    appears in session.new or session.deleted. Without this, granting Club
    Admin to an account would leave no trace — and role changes are the first
    thing the audit trail exists to catch.
    """
    state = inspect(user)
    if state is None:
        return []
    history = state.attrs.roles.history

    entries: list[AuditLog | None] = []
    for role in history.added or ():
        entries.append(
            _entry(
                user,
                "role_granted",
                action="user.role_granted",
                label=f"{user.email}: {role.key}",
            )
        )
    for role in history.deleted or ():
        entries.append(
            _entry(
                user,
                "role_revoked",
                action="user.role_revoked",
                label=f"{user.email}: {role.key}",
            )
        )
    return entries


def _capture(session: Session, _flush_context: Any, _instances: Any) -> None:
    entries: list[AuditLog | None] = []

    for instance in session.new:
        if isinstance(instance, AuditLog):
            continue
        _ensure_id(instance)
        entries.append(_entry(instance, "created"))
        if isinstance(instance, User):
            entries.extend(_role_changes(instance))

    for instance in session.dirty:
        if isinstance(instance, AuditLog) or not session.is_modified(instance):
            continue
        changed = _changed_fields(instance)
        if changed:
            entries.append(_entry(instance, "updated", changed))
        if isinstance(instance, User):
            entries.extend(_role_changes(instance))

    for instance in session.deleted:
        if not isinstance(instance, AuditLog):
            entries.append(_entry(instance, "deleted"))

    # Unaudited tables yield None; only real entries are added.
    session.add_all([entry for entry in entries if entry is not None])


def register_audit_listener() -> None:
    """Attach the listener once, at application start."""
    if not event.contains(db.session, "before_flush", _capture):
        event.listen(db.session, "before_flush", _capture)
