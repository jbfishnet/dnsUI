"""Integration tests: full HTTP stack, health, CORS, content-type, cross-resource workflows."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_restart(monkeypatch):
    import app._restart as r
    monkeypatch.setattr(r, "restart_dnsmasq", lambda: None)
    import app.routes.dns as dns_mod
    monkeypatch.setattr(dns_mod, "restart_dnsmasq", lambda: None)
    import app.routes.dhcp as dhcp_mod
    monkeypatch.setattr(dhcp_mod, "restart_dnsmasq", lambda: None)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health_returns_200():
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

def test_cors_header_present(conf_path):
    resp = client.get("/api/dns", headers={"Origin": "http://example.com"})
    assert "access-control-allow-origin" in resp.headers


def test_cors_preflight(conf_path):
    resp = client.options(
        "/api/dns",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Content-Type
# ---------------------------------------------------------------------------

def test_dns_list_content_type(conf_path):
    resp = client.get("/api/dns")
    assert "application/json" in resp.headers["content-type"]


def test_dhcp_list_content_type(conf_path):
    resp = client.get("/api/dhcp")
    assert "application/json" in resp.headers["content-type"]


# ---------------------------------------------------------------------------
# Data integrity: creating DNS does not disturb DHCP and vice versa
# ---------------------------------------------------------------------------

def test_create_dns_does_not_remove_dhcp(conf_path):
    client.post("/api/dns", json={"hostname": "extra.local", "ip": "10.0.0.5"})
    resp = client.get("/api/dhcp")
    macs = {l["mac"] for l in resp.json()}
    assert "aa:bb:cc:dd:ee:ff" in macs
    assert "11:22:33:44:55:66" in macs


def test_create_dhcp_does_not_remove_dns(conf_path):
    client.post("/api/dhcp", json={"mac": "cc:dd:ee:ff:00:11", "ip": "192.168.1.202", "hostname": "extra"})
    resp = client.get("/api/dns")
    hostnames = {e["hostname"] for e in resp.json()}
    assert "router.local" in hostnames
    assert "nas.local" in hostnames


def test_delete_dns_does_not_remove_dhcp(conf_path):
    client.delete("/api/dns/router-local")
    resp = client.get("/api/dhcp")
    assert len(resp.json()) == 3


def test_delete_dhcp_does_not_remove_dns(conf_path):
    client.delete("/api/dhcp/aa-bb-cc-dd-ee-ff")
    resp = client.get("/api/dns")
    assert len(resp.json()) == 2


# ---------------------------------------------------------------------------
# Full workflow: create → read → update → delete
# ---------------------------------------------------------------------------

def test_dns_full_workflow(conf_path):
    # Create
    r = client.post("/api/dns", json={"hostname": "wf.local", "ip": "10.1.2.3"})
    assert r.status_code == 201
    entry_id = r.json()["id"]

    # Read back
    entries = client.get("/api/dns").json()
    assert any(e["hostname"] == "wf.local" for e in entries)

    # Update
    r = client.put(f"/api/dns/{entry_id}", json={"hostname": "wf.local", "ip": "10.1.2.99"})
    assert r.status_code == 200
    assert r.json()["ip"] == "10.1.2.99"

    # Delete
    r = client.delete(f"/api/dns/{entry_id}")
    assert r.status_code == 204

    # Gone
    entries = client.get("/api/dns").json()
    assert not any(e["hostname"] == "wf.local" for e in entries)


def test_dhcp_full_workflow(conf_path):
    # Create
    r = client.post("/api/dhcp", json={"mac": "01:02:03:04:05:06", "ip": "10.1.2.50", "hostname": "wfdevice"})
    assert r.status_code == 201
    lease_id = r.json()["id"]

    # Read back
    leases = client.get("/api/dhcp").json()
    assert any(l["hostname"] == "wfdevice" for l in leases)

    # Update
    r = client.put(f"/api/dhcp/{lease_id}", json={"mac": "01:02:03:04:05:06", "ip": "10.1.2.51", "hostname": "wfdevice-b"})
    assert r.status_code == 200
    assert r.json()["hostname"] == "wfdevice-b"

    # Delete
    r = client.delete(f"/api/dhcp/{lease_id}")
    assert r.status_code == 204

    # Gone
    leases = client.get("/api/dhcp").json()
    assert not any(l["hostname"] == "wfdevice-b" for l in leases)


# ---------------------------------------------------------------------------
# Config file survives multiple sequential writes
# ---------------------------------------------------------------------------

def test_sequential_writes_preserve_unmanaged_lines(conf_path):
    client.post("/api/dns", json={"hostname": "a.local", "ip": "10.0.0.1"})
    client.post("/api/dns", json={"hostname": "b.local", "ip": "10.0.0.2"})
    client.delete("/api/dns/a-local")
    client.post("/api/dhcp", json={"mac": "aa:11:bb:22:cc:33", "ip": "192.168.1.110", "hostname": "device1"})
    client.delete("/api/dhcp/aa-11-bb-22-cc-33")

    content = open(conf_path).read()
    assert "domain-needed" in content
    assert "bogus-priv" in content
    assert "dhcp-range" in content


# ---------------------------------------------------------------------------
# Empty config (no /etc/dnsmasq.conf)
# ---------------------------------------------------------------------------

def test_list_dns_with_missing_file(monkeypatch, tmp_path):
    missing = str(tmp_path / "nonexistent.conf")
    import app.routes.dns as dns_mod
    monkeypatch.setattr(dns_mod, "DNSMASQ_CONF", missing)
    resp = client.get("/api/dns")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_dhcp_with_missing_file(monkeypatch, tmp_path):
    missing = str(tmp_path / "nonexistent.conf")
    import app.routes.dhcp as dhcp_mod
    monkeypatch.setattr(dhcp_mod, "DNSMASQ_CONF", missing)
    resp = client.get("/api/dhcp")
    assert resp.status_code == 200
    assert resp.json() == []
