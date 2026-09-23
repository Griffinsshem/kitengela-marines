"""Club profile, social accounts and support methods.

All Club Admin only. Support methods hold the club's payment destinations: an
account that could change a paybill number is a payment redirect, so these do
not sit with the media or team roles.
"""

from __future__ import annotations

from flask import Response, jsonify
from sqlalchemy import select

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import commit_or_conflict, not_found, parse_body, parse_uuid
from app.extensions import db
from app.models.club import Club, SocialLink, SupportMethod
from app.schemas.admin import (
    ClubUpsert,
    SocialLinkCreate,
    SocialLinkUpdate,
    SupportMethodCreate,
    SupportMethodUpdate,
)
from app.schemas.public import (
    serialize_club,
    serialize_social_link_admin,
    serialize_support_method_admin,
)
from app.security.authorization import require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError
from app.utils.slugs import unique_slug
from app.utils.social import is_valid_social_url


@api_v1.get("/admin/club")
@require_capability(Capability.MANAGE_CLUB)
def get_club_admin() -> tuple[Response, int]:
    club = db.session.scalars(select(Club).limit(1)).first()
    return jsonify({"data": serialize_club(club) if club is not None else None}), 200


@api_v1.put("/admin/club")
@require_capability(Capability.MANAGE_CLUB)
def upsert_club() -> tuple[Response, int]:
    """Create the club record, or replace its details.

    PUT rather than POST/PATCH: there is exactly one club, and the request
    says what its details are.
    """
    payload = parse_body(ClubUpsert)
    values = payload.model_dump()
    # EmailStr is not a str as far as the database is concerned.
    if values.get("contact_email") is not None:
        values["contact_email"] = str(values["contact_email"])

    club = db.session.scalars(select(Club).limit(1)).first()

    if club is None:
        set_action("club.created")
        club = Club(
            slug=unique_slug(
                payload.name,
                lambda candidate: (
                    db.session.query(Club).filter_by(slug=candidate).first() is not None
                ),
            ),
            **values,
        )
        db.session.add(club)
        status = 201
    else:
        set_action("club.updated")
        # The slug stays as first created: it is in the public URL.
        for field, value in values.items():
            setattr(club, field, value)
        status = 200

    commit_or_conflict("The club record could not be saved.")
    return jsonify({"data": serialize_club(club)}), status


# --- Social links ----------------------------------------------------------


@api_v1.get("/admin/social-links")
@require_capability(Capability.MANAGE_CLUB)
def list_social_links_admin() -> tuple[Response, int]:
    links = db.session.scalars(
        select(SocialLink).order_by(SocialLink.display_order, SocialLink.platform)
    ).all()
    return jsonify({"data": [serialize_social_link_admin(link) for link in links]}), 200


@api_v1.post("/admin/social-links")
@require_capability(Capability.MANAGE_CLUB)
def create_social_link() -> tuple[Response, int]:
    payload = parse_body(SocialLinkCreate)
    link = SocialLink(**payload.model_dump())
    db.session.add(link)
    commit_or_conflict("That platform already has a link.")
    return jsonify({"data": serialize_social_link_admin(link)}), 201


@api_v1.patch("/admin/social-links/<link_id>")
@require_capability(Capability.MANAGE_CLUB)
def update_social_link(link_id: str) -> tuple[Response, int]:
    link = db.session.get(SocialLink, parse_uuid(link_id, "link id"))
    if link is None:
        not_found("Social link not found.")

    changes = parse_body(SocialLinkUpdate).model_dump(exclude_unset=True)
    # Either field alone changes what pair is stored, so the pair is rechecked.
    platform = changes.get("platform", link.platform)
    url = changes.get("url", link.url)
    if not is_valid_social_url(platform, url):
        raise ApiError(
            "Request validation failed.",
            status_code=422,
            code="validation_error",
            details=[{"field": "url", "message": "The URL must be on that platform's domain."}],
        )

    for field, value in changes.items():
        setattr(link, field, value)
    commit_or_conflict("That platform already has a link.")

    return jsonify({"data": serialize_social_link_admin(link)}), 200


@api_v1.delete("/admin/social-links/<link_id>")
@require_capability(Capability.MANAGE_CLUB)
def delete_social_link(link_id: str) -> tuple[Response, int]:
    link = db.session.get(SocialLink, parse_uuid(link_id, "link id"))
    if link is None:
        not_found("Social link not found.")

    db.session.delete(link)
    db.session.commit()
    return jsonify({"data": {"deleted": True}}), 200


# --- Support methods -------------------------------------------------------


@api_v1.get("/admin/support-methods")
@require_capability(Capability.MANAGE_CLUB)
def list_support_methods_admin() -> tuple[Response, int]:
    methods = db.session.scalars(
        select(SupportMethod).order_by(SupportMethod.display_order, SupportMethod.name)
    ).all()
    return jsonify({"data": [serialize_support_method_admin(m) for m in methods]}), 200


@api_v1.post("/admin/support-methods")
@require_capability(Capability.MANAGE_CLUB)
def create_support_method() -> tuple[Response, int]:
    payload = parse_body(SupportMethodCreate)
    set_action("support_method.created")

    method = SupportMethod(**payload.model_dump())
    db.session.add(method)
    db.session.commit()

    return jsonify({"data": serialize_support_method_admin(method)}), 201


@api_v1.patch("/admin/support-methods/<method_id>")
@require_capability(Capability.MANAGE_CLUB)
def update_support_method(method_id: str) -> tuple[Response, int]:
    method = db.session.get(SupportMethod, parse_uuid(method_id, "support method id"))
    if method is None:
        not_found("Support method not found.")

    changes = parse_body(SupportMethodUpdate).model_dump(exclude_unset=True)
    # Named separately in the audit log: changing where money goes is the one
    # edit here that matters most when reading the trail back.
    set_action(
        "support_method.account_changed"
        if {"account_value", "account_name", "kind"} & set(changes)
        else "support_method.updated"
    )

    for field, value in changes.items():
        setattr(method, field, value)
    db.session.commit()

    return jsonify({"data": serialize_support_method_admin(method)}), 200


@api_v1.delete("/admin/support-methods/<method_id>")
@require_capability(Capability.MANAGE_CLUB)
def delete_support_method(method_id: str) -> tuple[Response, int]:
    method = db.session.get(SupportMethod, parse_uuid(method_id, "support method id"))
    if method is None:
        not_found("Support method not found.")

    set_action("support_method.deleted")
    db.session.delete(method)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200
