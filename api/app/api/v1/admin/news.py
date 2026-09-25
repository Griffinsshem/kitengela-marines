"""News administration.

Writing and publishing are separate capabilities. MANAGE_NEWS prepares drafts;
PUBLISH_NEWS puts them in front of supporters. Today both belong to the Media
Officer, but the split lets the club add a contributor who drafts match reports
without being able to publish them.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from flask import Response, jsonify, request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import commit_or_conflict, not_found, parse_body, parse_uuid
from app.extensions import db
from app.models.club import Team
from app.models.enums import ArticleStatus
from app.models.match import Fixture
from app.models.media import MediaAsset
from app.models.news import Article, ArticleCategory
from app.schemas.admin import ArticleCreate, ArticlePublish, ArticleUpdate
from app.schemas.public import serialize_article_admin
from app.security.authorization import current_user, require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError
from app.utils.pagination import paginate
from app.utils.sanitize import sanitize_html
from app.utils.slugs import unique_slug


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


def _load(article_id: str) -> Article:
    article = db.session.get(Article, parse_uuid(article_id, "article id"))
    if article is None:
        not_found("Article not found.")
    return article


def _check_references(values: dict[str, Any]) -> None:
    """Every referenced row must exist; a dangling id would fail at the database."""
    checks: tuple[tuple[str, type[Any], str], ...] = (
        ("category_id", ArticleCategory, "Unknown category."),
        ("team_id", Team, "Unknown team."),
        ("fixture_id", Fixture, "Unknown fixture."),
        ("featured_image_id", MediaAsset, "Unknown media asset."),
    )
    for field, model, message in checks:
        value = values.get(field)
        if value is not None and db.session.get(model, value) is None:
            raise _invalid(field, message)


@api_v1.get("/admin/articles")
@require_capability(Capability.MANAGE_NEWS)
def list_articles_admin() -> tuple[Response, int]:
    stmt = (
        select(Article)
        .options(
            selectinload(Article.category),
            selectinload(Article.team),
            selectinload(Article.author),
            selectinload(Article.fixture),
        )
        .order_by(Article.updated_at.desc())
    )

    status = request.args.get("status")
    if status:
        try:
            stmt = stmt.where(Article.status == ArticleStatus(status))
        except ValueError as error:
            raise ApiError("Unknown status.", status_code=400) from error

    return jsonify(paginate(stmt, serialize_article_admin)), 200


@api_v1.get("/admin/articles/<article_id>")
@require_capability(Capability.MANAGE_NEWS)
def get_article_admin(article_id: str) -> tuple[Response, int]:
    """Preview: the full article in any state, sanitised exactly as the public page."""
    return jsonify({"data": serialize_article_admin(_load(article_id))}), 200


@api_v1.post("/admin/articles")
@require_capability(Capability.MANAGE_NEWS)
def create_article() -> tuple[Response, int]:
    payload = parse_body(ArticleCreate)
    values = payload.model_dump()
    _check_references(values)
    values["body_html"] = sanitize_html(payload.body_html)

    article = Article(
        slug=unique_slug(
            payload.title,
            lambda candidate: (
                db.session.query(Article).filter_by(slug=candidate).first() is not None
            ),
        ),
        author_id=current_user().id,
        status=ArticleStatus.DRAFT,
        **values,
    )
    db.session.add(article)
    commit_or_conflict("An article with that slug already exists.")

    return jsonify({"data": serialize_article_admin(article)}), 201


@api_v1.patch("/admin/articles/<article_id>")
@require_capability(Capability.MANAGE_NEWS)
def update_article(article_id: str) -> tuple[Response, int]:
    article = _load(article_id)
    changes = parse_body(ArticleUpdate).model_dump(exclude_unset=True)
    _check_references(changes)

    if "body_html" in changes:
        changes["body_html"] = sanitize_html(changes["body_html"])

    for field, value in changes.items():
        setattr(article, field, value)
    commit_or_conflict("That change conflicts with an existing article.")

    return jsonify({"data": serialize_article_admin(article)}), 200


@api_v1.post("/admin/articles/<article_id>/publish")
@require_capability(Capability.PUBLISH_NEWS)
def publish_article(article_id: str) -> tuple[Response, int]:
    article = _load(article_id)
    payload = parse_body(ArticlePublish)

    if not article.body_html.strip():
        raise _invalid("body_html", "An article needs a body before it can be published.")

    now = datetime.now(UTC)
    publish_at = payload.published_at or now
    set_action("article.scheduled" if publish_at > now else "article.published")

    article.status = ArticleStatus.PUBLISHED
    article.published_at = publish_at
    db.session.commit()

    return jsonify({"data": serialize_article_admin(article)}), 200


@api_v1.post("/admin/articles/<article_id>/unpublish")
@require_capability(Capability.PUBLISH_NEWS)
def unpublish_article(article_id: str) -> tuple[Response, int]:
    article = _load(article_id)
    set_action("article.unpublished")

    article.status = ArticleStatus.DRAFT
    article.published_at = None
    db.session.commit()

    return jsonify({"data": serialize_article_admin(article)}), 200


@api_v1.delete("/admin/articles/<article_id>")
@require_capability(Capability.MANAGE_NEWS)
def delete_article(article_id: str) -> tuple[Response, int]:
    """Drafts only. A live article is unpublished first, deliberately.

    Two steps rather than one means a story supporters may already have shared
    cannot disappear in a single mistaken click.
    """
    article = _load(article_id)

    if article.status == ArticleStatus.PUBLISHED:
        raise ApiError(
            "Unpublish the article before deleting it.", status_code=409, code="conflict"
        )

    set_action("article.deleted")
    db.session.delete(article)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200


@api_v1.get("/admin/article-categories")
@require_capability(Capability.MANAGE_NEWS)
def list_article_categories_admin() -> tuple[Response, int]:
    """Categories with their ids, which the public list omits."""
    categories = db.session.scalars(select(ArticleCategory).order_by(ArticleCategory.name)).all()
    return jsonify(
        {
            "data": [
                {"id": str(category.id), "name": category.name, "slug": category.slug}
                for category in categories
            ]
        }
    ), 200
