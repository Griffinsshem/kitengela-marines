"""The club and its teams.

Kitengela Marines and Marines Starlets are two rows in one `teams` table, not
two schemas. Every downstream model — squads, fixtures, articles, galleries —
points at `teams.id`, so an academy or U17 side later is an INSERT.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import SocialPlatform, SupportMethodKind, TeamCategory, TeamGender

if TYPE_CHECKING:
    from app.models.identity import TeamMembership
    from app.models.people import Player, StaffMember


class Club(UUIDPrimaryKey, Timestamped, Base):
    """The organisation itself. Exactly one row in practice.

    Nearly every factual field is nullable on purpose. A founding year or home
    ground that nobody has confirmed stays NULL, and the site renders an empty
    state — it does not get a plausible-looking default.
    """

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

    # One per line. A club's values list is half a dozen words each, so a
    # table would be more machinery than the content deserves.
    values_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    training_times: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    # Names the accent set the frontend applies to this team's pages. The colour
    # values live in the design system, never in the database.
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


class SocialLink(UUIDPrimaryKey, Timestamped, Base):
    """One official account. One row per platform."""

    __tablename__ = "social_links"
    __table_args__ = (UniqueConstraint("platform", name="uq_social_links_platform"),)

    platform: Mapped[SocialPlatform] = mapped_column(
        enum_column(SocialPlatform, "ck_social_links_platform"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(400), nullable=False)
    # What the club is called there, e.g. @kitengelamarines.
    handle: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<SocialLink {self.platform}>"


class SupportMethod(UUIDPrimaryKey, Timestamped, Base):
    """A way supporters can give.

    Holds destinations the club publishes, never credentials. Only the Club
    Admin may change these: a paybill number an attacker could edit is a
    payment redirect.
    """

    __tablename__ = "support_methods"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[SupportMethodKind] = mapped_column(
        enum_column(SupportMethodKind, "ck_support_methods_kind", length=40), nullable=False
    )

    # e.g. "Paybill" / "247247" / "Kitengela Marines FC"
    account_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    account_value: Mapped[str | None] = mapped_column(String(60), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(160), nullable=True)

    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Inactive by default: a payment destination goes public deliberately.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<SupportMethod {self.name}>"
