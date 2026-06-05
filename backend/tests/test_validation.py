"""Input validation tests: missing fields, malformed data, edge-case MAC/IP formats."""
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
# DNS — missing / malformed fields
# ---------------------------------------------------------------------------

def test_create_dns_missing_hostname(conf_path):
    resp = client.post("/api/dns", json={"ip": "10.0.0.1"})
    assert resp.status_code == 422


def test_create_dns_missing_ip(conf_path):
    resp = client.post("/api/dns", json={"hostname": "test.local"})
    assert resp.status_code == 422


def test_create_dns_empty_body(conf_path):
    resp = client.post("/api/dns", json={})
    assert resp.status_code == 422


def test_create_dns_null_hostname(conf_path):
    resp = client.post("/api/dns", json={"hostname": None, "ip": "10.0.0.1"})
    assert resp.status_code == 422


def test_update_dns_missing_ip(conf_path):
    resp = client.put("/api/dns/router-local", json={"hostname": "router.local"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# DHCP — missing / malformed fields
# ---------------------------------------------------------------------------

def test_create_dhcp_missing_mac(conf_path):
    resp = client.post("/api/dhcp", json={"ip": "192.168.1.200", "hostname": "test"})
    assert resp.status_code == 422


def test_create_dhcp_missing_ip(conf_path):
    resp = client.post("/api/dhcp", json={"mac": "aa:bb:cc:dd:ee:ff", "hostname": "test"})
    assert resp.status_code == 422


def test_create_dhcp_hostname_is_optional(conf_path):
    # hostname defaults to "" — a lease without a name is valid
    resp = client.post("/api/dhcp", json={"mac": "de:ad:00:00:00:01", "ip": "192.168.1.210"})
    assert resp.status_code == 201
    assert resp.json()["hostname"] == ""


def test_create_dhcp_empty_body(conf_path):
    resp = client.post("/api/dhcp", json={})
    assert resp.status_code == 422


def test_update_dhcp_missing_fields(conf_path):
    resp = client.put("/api/dhcp/aa-bb-cc-dd-ee-ff", json={"mac": "aa:bb:cc:dd:ee:ff"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Parser — edge cases for MAC format in dhcp-host lines
# ---------------------------------------------------------------------------

def test_dhcp_mac_with_uppercase_parsed(tmp_path, monkeypatch):
    """dnsmasq allows uppercase MACs — parser should handle them."""
    import app.routes.dhcp as dhcp_mod
    conf = tmp_path / "dnsmasq.conf"
    conf.write_text("dhcp-host=AA:BB:CC:DD:EE:FF,192.168.1.200,uppermac\n")
    monkeypatch.setattr(dhcp_mod, "DNSMASQ_CONF", str(conf))
    resp = client.get("/api/dhcp")
    assert resp.status_code == 200
    leases = resp.json()
    assert len(leases) == 1
    assert leases[0]["mac"] == "AA:BB:CC:DD:EE:FF"
    assert leases[0]["hostname"] == "uppermac"


def test_dns_with_subdomain_parsed(tmp_path, monkeypatch):
    """Multi-level subdomain hostnames should parse correctly."""
    import app.routes.dns as dns_mod
    conf = tmp_path / "dnsmasq.conf"
    conf.write_text("address=/deep.sub.domain.local/10.0.0.50\n")
    monkeypatch.setattr(dns_mod, "DNSMASQ_CONF", str(conf))
    resp = client.get("/api/dns")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 1
    assert entries[0]["hostname"] == "deep.sub.domain.local"
    assert entries[0]["ip"] == "10.0.0.50"


def test_comments_not_parsed_as_entries(tmp_path, monkeypatch):
    """Comment lines must never appear as DNS or DHCP entries."""
    import app.routes.dns as dns_mod
    import app.routes.dhcp as dhcp_mod
    conf = tmp_path / "dnsmasq.conf"
    conf.write_text(
        "# address=/commented.local/1.2.3.4\n"
        "# dhcp-host=aa:bb:cc:dd:ee:ff,10.0.0.1,commented\n"
        "address=/real.local/10.0.0.5\n"
    )
    monkeypatch.setattr(dns_mod, "DNSMASQ_CONF", str(conf))
    monkeypatch.setattr(dhcp_mod, "DNSMASQ_CONF", str(conf))

    dns = client.get("/api/dns").json()
    dhcp = client.get("/api/dhcp").json()

    assert len(dns) == 1
    assert dns[0]["hostname"] == "real.local"
    assert len(dhcp) == 0


def test_blank_lines_in_config_preserved(conf_path):
    """Blank lines in the config must survive a write cycle."""
    client.post("/api/dns", json={"hostname": "extra.local", "ip": "10.0.0.99"})
    client.delete("/api/dns/extra-local")
    content = open(conf_path).read()
    # Original config had blank lines between sections
    assert "\n\n" in content
