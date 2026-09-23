"""Sponsors and messages from the public."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import SponsorTier, SubmissionKind, SubmissionStatus

if TYPE_CHECKING:
    from app.models.identity import User
    from app.models.media import MediaAsset


class Sponsor(UUIDPrimaryKey, Timestamped, Base):
    """A partner of the club.

    The table exists before any sponsor does. The brief forbids inventing
    partners, so until a real one signs the public endpoint returns nothing and
    the site shows its "become a partner" state.
    """

    __tablename__ = "sponsors"

    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    website_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    tier: Mapped[SponsorTier] = mapped_column(
        enum_column(SponsorTier, "ck_sponsors_tier"), nullable=False, default=SponsorTier.COMMUNITY
    )

    # From the media library, so alt text travels with the logo and the in-use
    # guard stops it being deleted while a live page shows it.
    logo_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=True
    )

    partnership_since: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    logo_asset: Mapped[MediaAsset | None] = relationship()

    def __repr__(self) -> str:
        return f"<Sponsor {self.slug}>"


class Submission(UUIDPrimaryKey, Timestamped, Base):
    """A message sent through a public form.

    Stored, never emailed on receipt. No mail service is configured, and an
    endpoint that sends mail on an anonymous request is an open relay for
    harassment through the club's own address.

    Everything here is typed by a stranger. It is stored as plain text and
    rendered as text, never as HTML.
    """

    __tablename__ = "submissions"

    kind: Mapped[SubmissionKind] = mapped_column(
        enum_column(SubmissionKind, "ck_submissions_kind"), nullable=False, index=True
    )
    status: Mapped[SubmissionStatus] = mapped_column(
        enum_column(SubmissionStatus, "ck_submissions_status"),
        nullable=False,
        default=SubmissionStatus.NEW,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Partnership enquiries only.
    organisation: Mapped[str | None] = mapped_column(String(160), nullable=True)
    interest: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Kept for blocking a persistent abuser, not for analytics.
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    handled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    handled_by: Mapped[User | None] = relationship()

    def __repr__(self) -> str:
        return f"<Submission {self.kind} {self.status}>"
