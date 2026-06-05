"""Tests for DHCP CRUD endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.parser import load_all


@pytest.fixture(autouse=True)
def no_restart(monkeypatch):
    """Prevent actual systemctl calls during tests."""
    import app._restart as r
    monkeypatch.setattr(r, "restart_dnsmasq", lambda: None)
    import app.routes.dhcp as dhcp_mod
    monkeypatch.setattr(dhcp_mod, "restart_dnsmasq", lambda: None)


client = TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/dhcp
# ---------------------------------------------------------------------------

def test_list_dhcp_returns_leases(conf_path):
    resp = client.get("/api/dhcp")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3
    macs = {l["mac"] for l in data}
    assert "aa:bb:cc:dd:ee:ff" in macs
    assert "11:22:33:44:55:66" in macs
    assert "AA:BB:CC:DD:EE:11" in macs


def test_list_dhcp_lease_has_id(conf_path):
    resp = client.get("/api/dhcp")
    for lease in resp.json():
        assert "id" in lease
        assert lease["id"] is not None


def test_list_dhcp_lease_fields(conf_path):
    resp = client.get("/api/dhcp")
    lease = next(l for l in resp.json() if l["mac"] == "aa:bb:cc:dd:ee:ff")
    assert lease["ip"] == "192.168.1.100"
    assert lease["hostname"] == "laptop"


def test_list_dhcp_lease_without_hostname(conf_path):
    resp = client.get("/api/dhcp")
    lease = next(l for l in resp.json() if l["mac"] == "11:22:33:44:55:66")
    assert lease["ip"] == "192.168.1.101"
    assert lease["hostname"] == ""


def test_list_dhcp_lease_uppercase_mac(conf_path):
    resp = client.get("/api/dhcp")
    lease = next(l for l in resp.json() if l["mac"] == "AA:BB:CC:DD:EE:11")
    assert lease["ip"] == "192.168.1.102"
    assert lease["hostname"] == "desktop"


# ---------------------------------------------------------------------------
# POST /api/dhcp
# ---------------------------------------------------------------------------

def test_create_dhcp_lease(conf_path):
    payload = {"mac": "de:ad:be:ef:00:01", "ip": "192.168.1.200", "hostname": "newdevice"}
    resp = client.post("/api/dhcp", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["mac"] == "de:ad:be:ef:00:01"
    assert data["ip"] == "192.168.1.200"
    assert data["hostname"] == "newdevice"
    assert data["id"] == "de-ad-be-ef-00-01"


def test_create_dhcp_persisted(conf_path):
    client.post("/api/dhcp", json={"mac": "ca:fe:ba:be:00:01", "ip": "192.168.1.201", "hostname": "saveddevice"})
    resp = client.get("/api/dhcp")
    macs = {l["mac"] for l in resp.json()}
    assert "ca:fe:ba:be:00:01" in macs


def test_create_dhcp_duplicate_returns_409(conf_path):
    resp = client.post("/api/dhcp", json={"mac": "aa:bb:cc:dd:ee:ff", "ip": "10.0.0.1", "hostname": "duplicate"})
    assert resp.status_code == 409


def test_create_dhcp_preserves_dns_entries(conf_path):
    client.post("/api/dhcp", json={"mac": "de:ad:be:ef:00:02", "ip": "192.168.1.202", "hostname": "anotherdevice"})
    resp = client.get("/api/dns")
    hostnames = {e["hostname"] for e in resp.json()}
    assert "router.local" in hostnames
    assert "nas.local" in hostnames


# ---------------------------------------------------------------------------
# PUT /api/dhcp/{id}
# ---------------------------------------------------------------------------

def test_update_dhcp_lease(conf_path):
    resp = client.put("/api/dhcp/aa-bb-cc-dd-ee-ff", json={
        "mac": "aa:bb:cc:dd:ee:ff",
        "ip": "192.168.1.150",
        "hostname": "laptop-updated"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ip"] == "192.168.1.150"
    assert data["hostname"] == "laptop-updated"


def test_update_dhcp_persisted(conf_path):
    client.put("/api/dhcp/aa-bb-cc-dd-ee-ff", json={
        "mac": "aa:bb:cc:dd:ee:ff",
        "ip": "10.10.10.50",
        "hostname": "laptop-new"
    })
    resp = client.get("/api/dhcp")
    lease = next(l for l in resp.json() if l["mac"] == "aa:bb:cc:dd:ee:ff")
    assert lease["ip"] == "10.10.10.50"
    assert lease["hostname"] == "laptop-new"


def test_update_dhcp_not_found(conf_path):
    resp = client.put("/api/dhcp/nonexistent", json={
        "mac": "ff:ff:ff:ff:ff:ff",
        "ip": "1.2.3.4",
        "hostname": "ghost"
    })
    assert resp.status_code == 404


def test_update_dhcp_mac_changes_id(conf_path):
    resp = client.put("/api/dhcp/aa-bb-cc-dd-ee-ff", json={
        "mac": "ff:ee:dd:cc:bb:aa",
        "ip": "192.168.1.100",
        "hostname": "laptop"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "ff-ee-dd-cc-bb-aa"


# ---------------------------------------------------------------------------
# DELETE /api/dhcp/{id}
# ---------------------------------------------------------------------------

def test_delete_dhcp_lease(conf_path):
    resp = client.delete("/api/dhcp/aa-bb-cc-dd-ee-ff")
    assert resp.status_code == 204


def test_delete_dhcp_removes_lease(conf_path):
    client.delete("/api/dhcp/aa-bb-cc-dd-ee-ff")
    resp = client.get("/api/dhcp")
    macs = {l["mac"] for l in resp.json()}
    assert "aa:bb:cc:dd:ee:ff" not in macs


def test_delete_dhcp_not_found(conf_path):
    resp = client.delete("/api/dhcp/ghost-entry")
    assert resp.status_code == 404


def test_delete_dhcp_preserves_other_lease(conf_path):
    client.delete("/api/dhcp/aa-bb-cc-dd-ee-ff")
    resp = client.get("/api/dhcp")
    macs = {l["mac"] for l in resp.json()}
    assert "11:22:33:44:55:66" in macs


def test_delete_dhcp_preserves_unrecognized_lines(conf_path):
    client.delete("/api/dhcp/aa-bb-cc-dd-ee-ff")
    content = open(conf_path).read()
    assert "domain-needed" in content
    assert "dhcp-range" in content


def test_delete_dhcp_preserves_dns_entries(conf_path):
    client.delete("/api/dhcp/aa-bb-cc-dd-ee-ff")
    resp = client.get("/api/dns")
    hostnames = {e["hostname"] for e in resp.json()}
    assert "router.local" in hostnames
