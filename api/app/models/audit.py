"""Audit trail.

Records who changed what and when. Entries are written by a session listener
rather than by each route, so an operation cannot go unlogged because somebody
forgot a call — which matters most for exactly the operations a person might
prefer to leave unrecorded.

Rows are append-only. Nothing in the application updates or deletes them.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey


class AuditLog(UUIDPrimaryKey, Timestamped, Base):
    __tablename__ = "audit_logs"

    # SET NULL, not CASCADE: deleting a user must not erase the record of what
    # they did. actor_email preserves who it was after the account is gone.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_email: Mapped[str | None] = mapped_column(String(254), nullable=True)

    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    target_label: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Field names only, never values. A diff of a player record would copy
    # phone numbers and emergency contacts into a second table that outlives
    # the record itself.
    changed_fields: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.target_type}>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "actor": self.actor_email,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "target_label": self.target_label,
            "changed_fields": self.changed_fields,
            "created_at": self.created_at.isoformat(),
        }
