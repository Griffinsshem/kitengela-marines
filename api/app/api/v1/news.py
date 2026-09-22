"""Public news endpoints.

A draft, a scheduled article and a slug that never existed all return the same
404. Distinguishing them would let anyone probe for stories the club has not
announced yet.
"""

from __future__ import annotations

from datetime import UTC, datetime

from flask import Response, jsonify, request
from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.extensions import db
from app.models.club import Team
from app.models.enums import ArticleStatus
from app.models.news import Article, ArticleCategory
from app.schemas.public import serialize_article, serialize_article_summary
from app.utils.errors import ApiError
from app.utils.http import cached
from app.utils.pagination import paginate


def _published() -> Select[tuple[Article]]:
    """Articles a supporter may see right now: published and not scheduled."""
    return (
        select(Article)
        .where(
            Article.status == ArticleStatus.PUBLISHED,
            Article.published_at <= datetime.now(UTC),
        )
        .options(
            selectinload(Article.category),
            selectinload(Article.team),
            selectinload(Article.author),
        )
    )


@api_v1.get("/articles")
def list_articles() -> tuple[Response, int]:
    stmt = _published()

    category = request.args.get("category")
    if category:
        stmt = stmt.join(ArticleCategory, ArticleCategory.id == Article.category_id).where(
            ArticleCategory.slug == category
        )

    team = request.args.get("team")
    if team:
        stmt = stmt.join(Team, Team.id == Article.team_id).where(Team.slug == team)

    stmt = stmt.order_by(Article.published_at.desc(), Article.created_at.desc())
    # A scheduled article appears within a minute of its time: the edge cache
    # holds a listing for at most 60 seconds.
    return cached(jsonify(paginate(stmt, serialize_article_summary)), 60), 200


@api_v1.get("/articles/<slug>")
def get_article(slug: str) -> tuple[Response, int]:
    article = db.session.scalars(
        _published().where(Article.slug == slug).options(selectinload(Article.fixture))
    ).first()
    if article is None:
        raise ApiError("Article not found.", status_code=404, code="not_found")

    return cached(jsonify({"data": serialize_article(article)}), 60), 200


@api_v1.get("/article-categories")
def list_article_categories() -> tuple[Response, int]:
    categories = db.session.scalars(
        select(ArticleCategory).order_by(ArticleCategory.display_order, ArticleCategory.name)
    ).all()
    return cached(
        jsonify({"data": [{"name": c.name, "slug": c.slug} for c in categories]}), 300
    ), 200
