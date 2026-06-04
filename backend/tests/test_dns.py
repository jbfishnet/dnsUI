"""Tests for DNS CRUD endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.parser import load_all


@pytest.fixture(autouse=True)
def no_restart(monkeypatch):
    """Prevent actual systemctl calls during tests."""
    import app._restart as r
    monkeypatch.setattr(r, "restart_dnsmasq", lambda: None)
    import app.routes.dns as dns_mod
    monkeypatch.setattr(dns_mod, "restart_dnsmasq", lambda: None)


client = TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/dns
# ---------------------------------------------------------------------------

def test_list_dns_returns_entries(conf_path):
    resp = client.get("/api/dns")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2
    hostnames = {e["hostname"] for e in data}
    assert "router.local" in hostnames
    assert "nas.local" in hostnames


def test_list_dns_entry_has_id(conf_path):
    resp = client.get("/api/dns")
    for entry in resp.json():
        assert "id" in entry
        assert entry["id"] is not None


# ---------------------------------------------------------------------------
# POST /api/dns
# ---------------------------------------------------------------------------

def test_create_dns_entry(conf_path):
    payload = {"hostname": "newhost.local", "ip": "10.0.0.99"}
    resp = client.post("/api/dns", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["hostname"] == "newhost.local"
    assert data["ip"] == "10.0.0.99"
    assert data["id"] == "newhost-local"


def test_create_dns_persisted(conf_path):
    client.post("/api/dns", json={"hostname": "persisted.local", "ip": "10.0.0.1"})
    resp = client.get("/api/dns")
    hostnames = {e["hostname"] for e in resp.json()}
    assert "persisted.local" in hostnames


def test_create_dns_duplicate_returns_409(conf_path):
    resp = client.post("/api/dns", json={"hostname": "router.local", "ip": "192.168.1.255"})
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# PUT /api/dns/{id}
# ---------------------------------------------------------------------------

def test_update_dns_entry(conf_path):
    resp = client.put("/api/dns/router-local", json={"hostname": "router.local", "ip": "192.168.1.254"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ip"] == "192.168.1.254"


def test_update_dns_persisted(conf_path):
    client.put("/api/dns/router-local", json={"hostname": "router.local", "ip": "10.10.10.1"})
    resp = client.get("/api/dns")
    entry = next(e for e in resp.json() if e["hostname"] == "router.local")
    assert entry["ip"] == "10.10.10.1"


def test_update_dns_not_found(conf_path):
    resp = client.put("/api/dns/nonexistent", json={"hostname": "x.local", "ip": "1.2.3.4"})
    assert resp.status_code == 404


def test_update_dns_hostname_changes_id(conf_path):
    resp = client.put("/api/dns/router-local", json={"hostname": "gateway.local", "ip": "192.168.1.1"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "gateway-local"


# ---------------------------------------------------------------------------
# DELETE /api/dns/{id}
# ---------------------------------------------------------------------------

def test_delete_dns_entry(conf_path):
    resp = client.delete("/api/dns/nas-local")
    assert resp.status_code == 204


def test_delete_dns_removes_entry(conf_path):
    client.delete("/api/dns/nas-local")
    resp = client.get("/api/dns")
    hostnames = {e["hostname"] for e in resp.json()}
    assert "nas.local" not in hostnames


def test_delete_dns_not_found(conf_path):
    resp = client.delete("/api/dns/ghost-entry")
    assert resp.status_code == 404


def test_delete_preserves_other_entries(conf_path):
    client.delete("/api/dns/nas-local")
    resp = client.get("/api/dns")
    hostnames = {e["hostname"] for e in resp.json()}
    assert "router.local" in hostnames


def test_delete_preserves_unrecognized_lines(conf_path):
    client.delete("/api/dns/nas-local")
    content = open(conf_path).read()
    assert "domain-needed" in content
    assert "dhcp-range" in content
