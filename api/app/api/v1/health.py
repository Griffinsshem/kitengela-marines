from __future__ import annotations

import logging

from flask import Response, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import api_v1
from app.extensions import db, limiter

logger = logging.getLogger(__name__)


@api_v1.get("/health")
@limiter.exempt
def liveness() -> Response:
    return jsonify({"status": "ok"})


@api_v1.get("/health/ready")
@limiter.exempt
def readiness() -> tuple[Response, int]:
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        logger.error("readiness probe failed", exc_info=error)
        return jsonify({"status": "degraded", "database": "unavailable"}), 503
    return jsonify({"status": "ok", "database": "ok"}), 200
