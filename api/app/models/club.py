from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import TeamCategory, TeamGender

if TYPE_CHECKING:
    from app.models.identity import TeamMembership
    from app.models.people import Player, StaffMember


class Club(UUIDPrimaryKey, Timestamped, Base):
    __tablename__ = "clubs"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(60), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)

    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_ground: Mapped[str | None] = mapped_column(String(160), nullable=True)
    town: Mapped[str | None] = mapped_column(String(120), nullable=True)
    county: Mapped[str | None] = mapped_column(String(120), nullable=True)

    contact_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    mission: Mapped[str | None] = mapped_column(Text, nullable=True)

    teams: Mapped[list[Team]] = relationship(
        back_populates="club",
        cascade="all, delete-orphan",
        order_by="Team.display_order",
    )

    def __repr__(self) -> str:
        return f"<Club {self.slug}>"


class Team(UUIDPrimaryKey, Timestamped, Base):
    """A side that plays fixtures under the club's identity."""

    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("club_id", "name", name="uq_teams_club_name"),)

    club_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(60), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)

    category: Mapped[TeamCategory] = mapped_column(
        enum_column(TeamCategory, "ck_teams_category"),
        nullable=False,
        default=TeamCategory.SENIOR,
    )
    gender: Mapped[TeamGender] = mapped_column(
        enum_column(TeamGender, "ck_teams_gender"), nullable=False
    )

    accent_key: Mapped[str] = mapped_column(String(40), nullable=False)

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    club: Mapped[Club] = relationship(back_populates="teams")
    memberships: Mapped[list[TeamMembership]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )
    players: Mapped[list[Player]] = relationship(
        back_populates="team",
        order_by="(Player.squad_number.is_(None), Player.squad_number)",
    )
    staff_members: Mapped[list[StaffMember]] = relationship(
        back_populates="team",
        order_by="StaffMember.display_order",
    )

    def __repr__(self) -> str:
        return f"<Team {self.slug}>"
