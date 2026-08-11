"""Tests for service-level endpoints."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_check_returns_service_status() -> None:
    """The health endpoint should identify a running service."""

    with TestClient(app) as api_client:
        health_response = api_client.get("/health")

    assert health_response.status_code == 200
    assert health_response.json() == {
        "status": "ok",
        "service": "Lumen AI Service",
        "environment": "development",
    }
