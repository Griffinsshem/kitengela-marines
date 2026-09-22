"""News articles and their categories."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.base import Timestamped, UUIDPrimaryKey, enum_column
from app.models.enums import ArticleStatus

if TYPE_CHECKING:
    from app.models.club import Team
    from app.models.identity import User
    from app.models.match import Fixture


class ArticleCategory(UUIDPrimaryKey, Timestamped, Base):
    __tablename__ = "article_categories"

    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<ArticleCategory {self.slug}>"


class Article(UUIDPrimaryKey, Timestamped, Base):
    __tablename__ = "articles"
    __table_args__ = (
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="ck_articles_published_has_date",
        ),
        # Every public listing filters on status and orders by published_at.
        Index("ix_articles_status_published_at", "status", "published_at"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Generated once from the title and never changed: the URL gets shared.
    slug: Mapped[str] = mapped_column(String(220), nullable=False, unique=True, index=True)
    summary: Mapped[str | None] = mapped_column(String(300), nullable=True)
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default="")

    status: Mapped[ArticleStatus] = mapped_column(
        enum_column(ArticleStatus, "ck_articles_status"),
        nullable=False,
        default=ArticleStatus.DRAFT,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("article_categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fixture_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("fixtures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Credits a writer without an account, or overrides the author's name.
    byline: Mapped[str | None] = mapped_column(String(160), nullable=True)

    category: Mapped[ArticleCategory] = relationship()
    team: Mapped[Team | None] = relationship()
    fixture: Mapped[Fixture | None] = relationship()
    author: Mapped[User | None] = relationship()

    @property
    def display_author(self) -> str:
        if self.byline:
            return self.byline
        if self.author is not None:
            return self.author.full_name
        return "Kitengela Marines"

    def __repr__(self) -> str:
        return f"<Article {self.slug} {self.status}>"
