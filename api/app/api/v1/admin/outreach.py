"""Sponsor administration and the submissions inbox."""

from __future__ import annotations

from datetime import UTC, datetime

from flask import Response, jsonify, request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.v1 import api_v1
from app.api.v1.admin._helpers import commit_or_conflict, not_found, parse_body, parse_uuid
from app.extensions import db
from app.models.enums import SubmissionKind, SubmissionStatus
from app.models.media import MediaAsset
from app.models.outreach import Sponsor, Submission
from app.schemas.admin import SponsorCreate, SponsorUpdate, SubmissionUpdate
from app.schemas.public import serialize_sponsor_admin, serialize_submission
from app.security.authorization import current_user, require_capability
from app.security.permissions import Capability
from app.services.audit import set_action
from app.utils.errors import ApiError
from app.utils.pagination import paginate
from app.utils.slugs import unique_slug


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(
        "Request validation failed.",
        status_code=422,
        code="validation_error",
        details=[{"field": field, "message": message}],
    )


# --- Sponsors --------------------------------------------------------------


@api_v1.get("/admin/sponsors")
@require_capability(Capability.MANAGE_SPONSORS)
def list_sponsors_admin() -> tuple[Response, int]:
    stmt = (
        select(Sponsor)
        .options(selectinload(Sponsor.logo_asset))
        .order_by(Sponsor.display_order, Sponsor.name)
    )
    return jsonify(paginate(stmt, serialize_sponsor_admin)), 200


@api_v1.post("/admin/sponsors")
@require_capability(Capability.MANAGE_SPONSORS)
def create_sponsor() -> tuple[Response, int]:
    payload = parse_body(SponsorCreate)
    values = payload.model_dump()

    if (
        values["logo_asset_id"] is not None
        and db.session.get(MediaAsset, values["logo_asset_id"]) is None
    ):
        raise _invalid("logo_asset_id", "Unknown media asset.")

    sponsor = Sponsor(
        slug=unique_slug(
            payload.name,
            lambda candidate: (
                db.session.query(Sponsor).filter_by(slug=candidate).first() is not None
            ),
        ),
        **values,
    )
    db.session.add(sponsor)
    commit_or_conflict("A sponsor with that name already exists.")

    return jsonify({"data": serialize_sponsor_admin(sponsor)}), 201


@api_v1.patch("/admin/sponsors/<sponsor_id>")
@require_capability(Capability.MANAGE_SPONSORS)
def update_sponsor(sponsor_id: str) -> tuple[Response, int]:
    sponsor = db.session.get(Sponsor, parse_uuid(sponsor_id, "sponsor id"))
    if sponsor is None:
        not_found("Sponsor not found.")

    changes = parse_body(SponsorUpdate).model_dump(exclude_unset=True)
    logo_id = changes.get("logo_asset_id")
    if logo_id is not None and db.session.get(MediaAsset, logo_id) is None:
        raise _invalid("logo_asset_id", "Unknown media asset.")

    for field, value in changes.items():
        setattr(sponsor, field, value)
    commit_or_conflict("A sponsor with that name already exists.")

    return jsonify({"data": serialize_sponsor_admin(sponsor)}), 200


@api_v1.delete("/admin/sponsors/<sponsor_id>")
@require_capability(Capability.MANAGE_SPONSORS)
def delete_sponsor(sponsor_id: str) -> tuple[Response, int]:
    sponsor = db.session.get(Sponsor, parse_uuid(sponsor_id, "sponsor id"))
    if sponsor is None:
        not_found("Sponsor not found.")

    set_action("sponsor.deleted")
    db.session.delete(sponsor)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200


# --- Submissions -----------------------------------------------------------


@api_v1.get("/admin/submissions")
@require_capability(Capability.MANAGE_CLUB)
def list_submissions() -> tuple[Response, int]:
    stmt = (
        select(Submission)
        .options(selectinload(Submission.handled_by))
        .order_by(Submission.created_at.desc())
    )

    kind = request.args.get("kind")
    if kind:
        try:
            stmt = stmt.where(Submission.kind == SubmissionKind(kind))
        except ValueError as error:
            raise ApiError("Unknown kind.", status_code=400) from error

    status = request.args.get("status")
    if status:
        try:
            stmt = stmt.where(Submission.status == SubmissionStatus(status))
        except ValueError as error:
            raise ApiError("Unknown status.", status_code=400) from error

    return jsonify(paginate(stmt, serialize_submission)), 200


@api_v1.patch("/admin/submissions/<submission_id>")
@require_capability(Capability.MANAGE_CLUB)
def update_submission(submission_id: str) -> tuple[Response, int]:
    """Records how the club handled a message. The message itself is never
    editable: it is what somebody sent."""
    submission = db.session.get(Submission, parse_uuid(submission_id, "submission id"))
    if submission is None:
        not_found("Submission not found.")

    changes = parse_body(SubmissionUpdate).model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(submission, field, value)

    if "status" in changes:
        submission.handled_by_id = current_user().id
        submission.handled_at = datetime.now(UTC)

    db.session.commit()
    return jsonify({"data": serialize_submission(submission)}), 200


@api_v1.delete("/admin/submissions/<submission_id>")
@require_capability(Capability.MANAGE_CLUB)
def delete_submission(submission_id: str) -> tuple[Response, int]:
    """Deleting spam is the point; keeping it forever is not.

    Audited, so a deleted enquiry leaves a trace even though its content is
    gone.
    """
    submission = db.session.get(Submission, parse_uuid(submission_id, "submission id"))
    if submission is None:
        not_found("Submission not found.")

    set_action("submission.deleted")
    db.session.delete(submission)
    db.session.commit()

    return jsonify({"data": {"deleted": True}}), 200
