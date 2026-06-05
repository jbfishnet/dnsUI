"""Shared fixtures for backend tests."""
import os
import tempfile

import pytest

SAMPLE_CONF = """\
# dnsmasq configuration
domain-needed
bogus-priv
interface=eth0  # network interface

address=/router.local/192.168.1.1
address=/nas.local/192.168.1.50

# Static DHCP lease with hostname
dhcp-host=aa:bb:cc:dd:ee:ff,192.168.1.100,laptop
# Static DHCP lease without hostname (real-world format)
dhcp-host=11:22:33:44:55:66,192.168.1.101
# Uppercase MAC (real-world format)
dhcp-host=AA:BB:CC:DD:EE:11,192.168.1.102,desktop

dhcp-range=192.168.1.100,192.168.1.200,12h
dhcp-option=3,192.168.1.1
dhcp-option=6,192.168.1.1
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
