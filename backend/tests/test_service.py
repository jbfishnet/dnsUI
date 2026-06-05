"""Tests for /api/service routes."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_service(monkeypatch):
    """Prevent real systemctl calls — patch names as imported in the route module."""
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_status", lambda: "active")
    monkeypatch.setattr(svc_mod, "service_action", lambda action: (True, ""))


# ---------------------------------------------------------------------------
# GET /api/service/status
# ---------------------------------------------------------------------------

def test_get_status_returns_200():
    resp = client.get("/api/service/status")
    assert resp.status_code == 200


def test_get_status_returns_active():
    resp = client.get("/api/service/status")
    assert resp.json() == {"status": "active"}


def test_get_status_returns_inactive(monkeypatch):
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_status", lambda: "inactive")
    resp = client.get("/api/service/status")
    assert resp.json()["status"] == "inactive"


def test_get_status_returns_failed(monkeypatch):
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_status", lambda: "failed")
    resp = client.get("/api/service/status")
    assert resp.json()["status"] == "failed"


def test_get_status_returns_unknown(monkeypatch):
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_status", lambda: "unknown")
    resp = client.get("/api/service/status")
    assert resp.json()["status"] == "unknown"


def test_get_status_content_type():
    resp = client.get("/api/service/status")
    assert "application/json" in resp.headers["content-type"]


# ---------------------------------------------------------------------------
# POST /api/service/start
# ---------------------------------------------------------------------------

def test_start_returns_200():
    resp = client.post("/api/service/start")
    assert resp.status_code == 200


def test_start_returns_started_status():
    resp = client.post("/api/service/start")
    assert resp.json()["status"] == "started"
    assert resp.json()["service"] == "dnsmasq"


def test_start_calls_service_action_with_start(monkeypatch):
    called_with: list[str] = []
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_action", lambda action: called_with.append(action) or (True, ""))
    client.post("/api/service/start")
    assert "start" in called_with


# ---------------------------------------------------------------------------
# POST /api/service/stop
# ---------------------------------------------------------------------------

def test_stop_returns_200():
    resp = client.post("/api/service/stop")
    assert resp.status_code == 200


def test_stop_returns_stopped_status():
    resp = client.post("/api/service/stop")
    assert resp.json()["status"] == "stopped"


def test_stop_calls_service_action_with_stop(monkeypatch):
    called_with: list[str] = []
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_action", lambda action: called_with.append(action) or (True, ""))
    client.post("/api/service/stop")
    assert "stop" in called_with


# ---------------------------------------------------------------------------
# POST /api/service/restart
# ---------------------------------------------------------------------------

def test_restart_returns_200():
    resp = client.post("/api/service/restart")
    assert resp.status_code == 200


def test_restart_returns_restarted_status():
    resp = client.post("/api/service/restart")
    assert resp.json()["status"] == "restarted"


def test_restart_calls_service_action_with_restart(monkeypatch):
    called_with: list[str] = []
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_action", lambda action: called_with.append(action) or (True, ""))
    client.post("/api/service/restart")
    assert "restart" in called_with


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

def test_action_returns_500_when_systemctl_fails(monkeypatch):
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_action", lambda action: (False, "Unit dnsmasq.service not found"))
    resp = client.post("/api/service/restart")
    assert resp.status_code == 500


def test_action_500_includes_error_detail(monkeypatch):
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_action", lambda action: (False, "Unit dnsmasq.service not found"))
    resp = client.post("/api/service/restart")
    assert "Unit dnsmasq.service not found" in resp.json()["detail"]


def test_action_500_generic_message_when_no_stderr(monkeypatch):
    import app.routes.service as svc_mod
    monkeypatch.setattr(svc_mod, "service_action", lambda action: (False, ""))
    resp = client.post("/api/service/restart")
    assert resp.status_code == 500
    assert "restart" in resp.json()["detail"]


def test_invalid_action_returns_422():
    """Path param validation: only start/stop/restart are valid ServiceAction values."""
    resp = client.post("/api/service/nuke")
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

def test_service_status_cors_header():
    resp = client.get("/api/service/status", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" in resp.headers


def test_service_action_cors_header():
    resp = client.post("/api/service/restart", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" in resp.headers
