"""Public club settings: social accounts and ways to support the club."""

from __future__ import annotations

from flask import Response, jsonify
from sqlalchemy import select

from app.api.v1 import api_v1
from app.extensions import db
from app.models.club import SocialLink, SupportMethod
from app.schemas.public import serialize_social_link, serialize_support_method
from app.utils.http import cached


@api_v1.get("/social-links")
def list_social_links() -> tuple[Response, int]:
    links = db.session.scalars(
        select(SocialLink)
        .where(SocialLink.is_active.is_(True))
        .order_by(SocialLink.display_order, SocialLink.platform)
    ).all()
    return cached(jsonify({"data": [serialize_social_link(link) for link in links]}), 3600), 200


@api_v1.get("/support-methods")
def list_support_methods() -> tuple[Response, int]:
    methods = db.session.scalars(
        select(SupportMethod)
        .where(SupportMethod.is_active.is_(True))
        .order_by(SupportMethod.display_order, SupportMethod.name)
    ).all()
    # A short cache: a correction to a paybill number should reach supporters
    # quickly, since the wrong one sends money to the wrong place.
    return cached(
        jsonify({"data": [serialize_support_method(method) for method in methods]}), 60
    ), 200
