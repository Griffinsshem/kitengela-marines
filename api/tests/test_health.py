from __future__ import annotations

from flask.testing import FlaskClient


def test_liveness_reports_ok(client: FlaskClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_readiness_reaches_the_database(client: FlaskClient) -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.get_json()["database"] == "ok"


def test_unknown_route_returns_the_error_envelope(client: FlaskClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    body = response.get_json()
    assert "error" in body
    assert set(body["error"]) >= {"code", "message"}
