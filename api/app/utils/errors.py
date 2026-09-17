from __future__ import annotations

import logging
import uuid
from typing import Any

from flask import Flask, Response, jsonify
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


def _envelope(code: str, message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError) -> tuple[Response, int]:
        return jsonify(_envelope(error.code, error.message, error.details)), error.status_code

    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError) -> tuple[Response, int]:
        details = [
            {"field": ".".join(str(part) for part in issue["loc"]), "message": issue["msg"]}
            for issue in error.errors()
        ]
        return jsonify(_envelope("validation_error", "Request validation failed.", details)), 422

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException) -> tuple[Response, int]:
        code = (error.name or "error").lower().replace(" ", "_")
        return jsonify(_envelope(code, error.description or error.name or "Error")), error.code or 500

    @app.errorhandler(SQLAlchemyError)
    def handle_database_error(error: SQLAlchemyError) -> tuple[Response, int]:
        incident = uuid.uuid4().hex[:12]
        # exc_info carries the SQL; it goes to the log, never to the response.
        logger.error("database error incident=%s", incident, exc_info=error)
        return jsonify(_envelope("database_error", "A database error occurred.", {"incident": incident})), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception) -> tuple[Response, int]:
        incident = uuid.uuid4().hex[:12]
        logger.error("unhandled error incident=%s", incident, exc_info=error)
        return jsonify(_envelope("internal_error", "An unexpected error occurred.", {"incident": incident})), 500
