"""Audit log access. Club Admin only.

Read-only by design: there is no endpoint that edits or deletes an entry, and
the application never writes to this table except through the listener.
"""

from __future__ import annotations

from flask import Response, jsonify, request
from sqlalchemy import select

from app.api.v1 import api_v1
from app.models.audit import AuditLog
from app.security.authorization import require_capability
from app.security.permissions import Capability
from app.utils.pagination import paginate


@api_v1.get("/admin/audit-logs")
@require_capability(Capability.MANAGE_USERS)
def list_audit_logs() -> tuple[Response, int]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())

    action = request.args.get("action")
    if action:
        stmt = stmt.where(AuditLog.action == action)

    target_type = request.args.get("target_type")
    if target_type:
        stmt = stmt.where(AuditLog.target_type == target_type)

    return jsonify(paginate(stmt, lambda entry: entry.to_dict())), 200
