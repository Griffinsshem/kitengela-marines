"""Uploaded media."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey

if TYPE_CHECKING:
    from app.models.identity import User


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
