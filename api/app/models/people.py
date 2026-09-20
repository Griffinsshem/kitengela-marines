from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import PlayerPosition, PlayerStatus, StaffRole

if TYPE_CHECKING:
    from app.models.club import Team
    from app.models.identity import User


class Player(UUIDPrimaryKey, Timestamped, Base):
    """A player in one of the club's squads."""

    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("team_id", "slug", name="uq_players_team_slug"),)

    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # --- public ------------------------------------------------------------
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    known_as: Mapped[str | None] = mapped_column(String(120), nullable=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    squad_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[PlayerPosition] = mapped_column(
        enum_column(PlayerPosition, "ck_players_position"), nullable=False
    )
    status: Mapped[PlayerStatus] = mapped_column(
        enum_column(PlayerStatus, "ck_players_status"),
        nullable=False,
        default=PlayerStatus.ACTIVE,
    )
    nationality: Mapped[str | None] = mapped_column(String(80), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    joined_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- club-internal: never serialised by a public endpoint --------------
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional link to a login. Most players will never have an account.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True
    )

    team: Mapped[Team] = relationship(back_populates="players")
    user: Mapped[User | None] = relationship(back_populates="player_profile")

    PUBLIC_FIELDS = (
        "id",
        "first_name",
        "last_name",
        "known_as",
        "slug",
        "squad_number",
        "position",
        "status",
        "nationality",
        "biography",
        "photo_url",
        "joined_on",
    )

    PLAYER_EDITABLE_FIELDS = ("known_as", "biography", "phone")

    @property
    def display_name(self) -> str:
        return self.known_as or f"{self.first_name} {self.last_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def is_in_current_squad(self) -> bool:
        return self.status not in (PlayerStatus.FORMER, PlayerStatus.INACTIVE)

    @property
    def statistics_count(self) -> int:
        """How many matches this player has a record in.

        Guards deletion: a player with match history must be retired, not
        removed, or the club's own records would change retroactively.
        """
        from app.models.match import PlayerMatchStatistic

        session = object_session(self)
        if session is None:
            return 0
        return session.query(PlayerMatchStatistic).filter_by(player_id=self.id).count()

    def public_dict(self) -> dict[str, object]:
        """Serialise only the allow-listed columns, plus derived display names."""
        data: dict[str, object] = {field: getattr(self, field) for field in self.PUBLIC_FIELDS}
        data["display_name"] = self.display_name
        return data

    def __repr__(self) -> str:
        return f"<Player {self.slug} team={self.team_id}>"


class StaffMember(UUIDPrimaryKey, Timestamped, Base):
    """Coaching, technical and club officials.

    Staff attach to a team when the role is team-specific (head coach) and leave
    team_id NULL when the role is club-wide (club official).
    """

    __tablename__ = "staff_members"
    __table_args__ = (UniqueConstraint("slug", name="uq_staff_slug"),)

    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # --- public ------------------------------------------------------------
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    role: Mapped[StaffRole] = mapped_column(
        enum_column(StaffRole, "ck_staff_role", length=40), nullable=False
    )
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # --- club-internal ------------------------------------------------------
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    team: Mapped[Team | None] = relationship(back_populates="staff_members")

    PUBLIC_FIELDS = (
        "id",
        "first_name",
        "last_name",
        "slug",
        "role",
        "biography",
        "photo_url",
        "display_order",
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def public_dict(self) -> dict[str, object]:
        data: dict[str, object] = {field: getattr(self, field) for field in self.PUBLIC_FIELDS}
        data["full_name"] = self.full_name
        return data

    def __repr__(self) -> str:
        return f"<StaffMember {self.slug}>"
