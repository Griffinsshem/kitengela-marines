"""Rate-limit counters, kept in the application's own database."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import Base


class RateLimitCounter(Base):
    """One fixed-window counter: how many hits a key has had, until when.

    Written only through `app.security.rate_limit_storage`, which increments
    atomically. Rows are disposable: losing them only forgives some attempts.
    """

    __tablename__ = "rate_limit_counters"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    hits: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
