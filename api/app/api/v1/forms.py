"""Public forms: contact and partnership enquiries.

The only endpoints where an unauthenticated stranger writes to the database.
"""

from __future__ import annotations

import logging

from flask import Response, jsonify, request
from sqlalchemy import select

from app.api.v1 import api_v1
from app.extensions import db, limiter
from app.models.enums import SubmissionKind
from app.models.outreach import Sponsor, Submission
from app.schemas.public import serialize_sponsor
from app.schemas.public_forms import ContactSubmission, PartnershipSubmission
from app.services.spam import (
    SubmissionRejectedError,
    accepted_response,
    check_not_automated,
    client_ip,
)
from app.utils.errors import ApiError
from app.utils.http import cached

logger = logging.getLogger(__name__)


@api_v1.get("/sponsors")
def list_sponsors() -> tuple[Response, int]:
    """Active partners. Empty until the club has one; the site shows its
    'become a partner' state rather than invented logos."""
    sponsors = db.session.scalars(
        select(Sponsor)
        .where(Sponsor.is_active.is_(True))
        .order_by(Sponsor.display_order, Sponsor.name)
    ).all()
    return cached(jsonify({"data": [serialize_sponsor(s) for s in sponsors]}), 600), 200


def _body() -> dict[str, object]:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("A JSON object body is required.", status_code=400)
    return body


@api_v1.post("/contact")
@limiter.limit("3 per minute; 10 per hour; 30 per day")
def submit_contact() -> tuple[Response, int]:
    payload = ContactSubmission.model_validate(_body())

    try:
        check_not_automated(payload.website, payload.rendered_at)
    except SubmissionRejectedError as reason:
        # Logged, not stored, and the sender is told it went through: a bot
        # that learns which attempts failed can tune itself past the checks.
        logger.info("contact submission dropped: %s", reason)
        body, status = accepted_response()
        return jsonify(body), status

    submission = Submission(
        kind=SubmissionKind.CONTACT,
        name=payload.name,
        email=str(payload.email),
        phone=payload.phone,
        subject=payload.subject,
        message=payload.message,
        ip_address=client_ip(dict(request.headers), request.remote_addr),
    )
    db.session.add(submission)
    db.session.commit()

    body, status = accepted_response()
    return jsonify(body), status


@api_v1.post("/partnership-enquiries")
@limiter.limit("3 per minute; 10 per hour; 30 per day")
def submit_partnership_enquiry() -> tuple[Response, int]:
    payload = PartnershipSubmission.model_validate(_body())

    try:
        check_not_automated(payload.website, payload.rendered_at)
    except SubmissionRejectedError as reason:
        logger.info("partnership enquiry dropped: %s", reason)
        body, status = accepted_response()
        return jsonify(body), status

    submission = Submission(
        kind=SubmissionKind.PARTNERSHIP,
        name=payload.name,
        organisation=payload.organisation,
        email=str(payload.email),
        phone=payload.phone,
        interest=payload.interest,
        message=payload.message,
        ip_address=client_ip(dict(request.headers), request.remote_addr),
    )
    db.session.add(submission)
    db.session.commit()

    body, status = accepted_response()
    return jsonify(body), status
