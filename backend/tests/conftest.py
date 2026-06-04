"""Shared fixtures for backend tests."""
import os
import tempfile

import pytest

SAMPLE_CONF = """\
# dnsmasq configuration
domain-needed
bogus-priv

address=/router.local/192.168.1.1
address=/nas.local/192.168.1.50

dhcp-host=aa:bb:cc:dd:ee:ff,192.168.1.100,laptop
dhcp-host=11:22:33:44:55:66,192.168.1.101,desktop

dhcp-range=192.168.1.100,192.168.1.200,12h
"""


@pytest.fixture
def conf_path(monkeypatch, tmp_path):
    """Create a temp dnsmasq.conf and point DNSMASQ_CONF at it."""
    p = tmp_path / "dnsmasq.conf"
    p.write_text(SAMPLE_CONF)
    monkeypatch.setenv("DNSMASQ_CONF", str(p))
    # Also patch the module-level constant in config and routes
    import app.config as cfg
    monkeypatch.setattr(cfg, "DNSMASQ_CONF", str(p))
    import app.routes.dns as dns_mod
    monkeypatch.setattr(dns_mod, "DNSMASQ_CONF", str(p))
    import app.routes.dhcp as dhcp_mod
    monkeypatch.setattr(dhcp_mod, "DNSMASQ_CONF", str(p))
    return str(p)
