"""Competitions, seasons and opponent clubs.

Opponents are rows, not free text. Typed opponent names produce "Kitengela FC",
"kitengela fc" and "Kitengela F.C." as three distinct clubs, which quietly
breaks any league table computed from them.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey

if TYPE_CHECKING:
    from app.models.match import Fixture, LeagueStanding


class Competition(UUIDPrimaryKey, Timestamped, Base):
    """A league or cup the club enters, e.g. the Kajiado County League."""

    __tablename__ = "competitions"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    short_name: Mapped[str] = mapped_column(String(60), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)

    # A league produces a table; a cup does not.
    has_standings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    seasons: Mapped[list[Season]] = relationship(
        back_populates="competition", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Competition {self.slug}>"


class Season(UUIDPrimaryKey, Timestamped, Base):
    """One edition of a competition.

    Modelled from the start so the club accumulates history rather than
    overwriting last season every August.
    """

    __tablename__ = "seasons"
    __table_args__ = (UniqueConstraint("competition_id", "label", name="uq_seasons_comp_label"),)

    competition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Free text, e.g. "2026/27". Kenyan season conventions vary by competition.
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)

    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Exactly one season per competition should be current. Enforced in the
    # service layer, since a partial unique index is awkward to express here.
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    competition: Mapped[Competition] = relationship(back_populates="seasons")
    fixtures: Mapped[list[Fixture]] = relationship(
        back_populates="season", cascade="all, delete-orphan"
    )
    standings: Mapped[list[LeagueStanding]] = relationship(
        back_populates="season",
        cascade="all, delete-orphan",
        order_by="LeagueStanding.position",
    )

    def __repr__(self) -> str:
        return f"<Season {self.slug}>"


class Opponent(UUIDPrimaryKey, Timestamped, Base):
    """Another club the team plays or shares a league table with."""

    __tablename__ = "opponents"

    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    short_name: Mapped[str] = mapped_column(String(60), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    crest_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    home_ground: Mapped[str | None] = mapped_column(String(160), nullable=True)

    def __repr__(self) -> str:
        return f"<Opponent {self.slug}>"
