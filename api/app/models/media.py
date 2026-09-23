"""Uploaded media."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey

if TYPE_CHECKING:
    from app.models.club import Team
    from app.models.identity import User
    from app.models.match import Fixture


class MediaAsset(UUIDPrimaryKey, Timestamped, Base):
    """One stored image.

    The row is the club's record of the file: which driver holds it, where a
    browser fetches it, and what it shows. Swapping storage provider later
    means rewriting url and storage_key, not losing the library.
    """

    __tablename__ = "media_assets"

    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    url: Mapped[str] = mapped_column(String(700), nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)

    # NOT NULL: an image with no alt text is invisible to a screen reader, and
    # the moment to write it is while the uploader can still see the photo.
    alt_text: Mapped[str] = mapped_column(String(250), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by: Mapped[User | None] = relationship()

    def __repr__(self) -> str:
        return f"<MediaAsset {self.storage_key}>"


class Gallery(UUIDPrimaryKey, Timestamped, Base):
    """A set of photographs from one occasion.

    Published with a flag rather than a date. Articles schedule because
    match-day copy is written in advance; a gallery goes up when the photos
    are ready.
    """

    __tablename__ = "galleries"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fixture_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("fixtures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # SET NULL: losing a cover photo should not take the gallery with it.
    cover_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )

    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    team: Mapped[Team | None] = relationship()
    fixture: Mapped[Fixture | None] = relationship()
    cover_asset: Mapped[MediaAsset | None] = relationship(foreign_keys=[cover_asset_id])
    items: Mapped[list[GalleryItem]] = relationship(
        back_populates="gallery",
        cascade="all, delete-orphan",
        order_by="GalleryItem.position",
    )

    def __repr__(self) -> str:
        return f"<Gallery {self.slug}>"


class GalleryItem(UUIDPrimaryKey, Timestamped, Base):
    """One photograph's place in one gallery."""

    __tablename__ = "gallery_items"
    __table_args__ = (
        UniqueConstraint("gallery_id", "asset_id", name="uq_gallery_items_gallery_asset"),
    )

    gallery_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("galleries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT is the database's backstop for the in-use check in the route: a
    # photo a gallery depends on cannot be deleted out from under it.
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Overrides the asset's own caption for this gallery.
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    gallery: Mapped[Gallery] = relationship(back_populates="items")
    asset: Mapped[MediaAsset] = relationship()

    def __repr__(self) -> str:
        return f"<GalleryItem gallery={self.gallery_id} position={self.position}>"


class Video(UUIDPrimaryKey, Timestamped, Base):
    """A YouTube video.

    Hosting video ourselves would cost far more in storage and bandwidth than
    the club needs to spend, and YouTube handles transcoding and streaming.
    """

    __tablename__ = "videos"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    # The id alone. A stored URL could point anywhere, and the site frames it.
    youtube_id: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fixture_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("fixtures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    team: Mapped[Team | None] = relationship()
    fixture: Mapped[Fixture | None] = relationship()

    @property
    def thumbnail_url(self) -> str:
        return f"https://i.ytimg.com/vi/{self.youtube_id}/hqdefault.jpg"

    @property
    def embed_url(self) -> str:
        # nocookie: YouTube sets no tracking cookie until the viewer presses play.
        return f"https://www.youtube-nocookie.com/embed/{self.youtube_id}"

    def __repr__(self) -> str:
        return f"<Video {self.slug}>"
