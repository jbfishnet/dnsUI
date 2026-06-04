"""Tests for parser.py"""
import os
import tempfile

import pytest

from app.parser import (
    _other_lines,
    dns_id,
    dhcp_id,
    load_all,
    parse_dhcp_leases,
    parse_dns_entries,
    read_config,
    write_config,
)
from app.models import DnsEntry, DhcpLease


SAMPLE_CONF = """\
# dnsmasq configuration
domain-needed
bogus-priv

# DNS entries
address=/router.local/192.168.1.1
address=/nas.local/192.168.1.50
address=/pi.local/192.168.1.2

# DHCP static leases
dhcp-host=aa:bb:cc:dd:ee:ff,192.168.1.100,laptop
dhcp-host=11:22:33:44:55:66,192.168.1.101,desktop

dhcp-range=192.168.1.100,192.168.1.200,12h
"""


@pytest.fixture
def conf_file():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".conf", delete=False) as f:
        f.write(SAMPLE_CONF)
        path = f.name
    yield path
    os.unlink(path)


# ---------------------------------------------------------------------------
# read_config
# ---------------------------------------------------------------------------

def test_read_config_returns_lines(conf_file):
    lines = read_config(conf_file)
    assert isinstance(lines, list)
    assert len(lines) > 0


def test_read_config_missing_file():
    lines = read_config("/nonexistent/path/dnsmasq.conf")
    assert lines == []


# ---------------------------------------------------------------------------
# parse_dns_entries
# ---------------------------------------------------------------------------

def test_parse_dns_entries(conf_file):
    lines = read_config(conf_file)
    entries = parse_dns_entries(lines)
    assert len(entries) == 3
    hostnames = {e.hostname for e in entries}
    assert hostnames == {"router.local", "nas.local", "pi.local"}


def test_parse_dns_entry_fields(conf_file):
    lines = read_config(conf_file)
    entries = parse_dns_entries(lines)
    entry = next(e for e in entries if e.hostname == "router.local")
    assert entry.ip == "192.168.1.1"
    assert entry.id == dns_id("router.local")


def test_parse_dns_entries_empty():
    entries = parse_dns_entries(["# comment", "domain-needed", ""])
    assert entries == []


def test_parse_dns_id_slug():
    assert dns_id("my.host.local") == "my-host-local"
    assert dns_id("UPPERCASE.local") == "uppercase-local"
    assert dns_id("host_name") == "host-name"


# ---------------------------------------------------------------------------
# parse_dhcp_leases
# ---------------------------------------------------------------------------

def test_parse_dhcp_leases(conf_file):
    lines = read_config(conf_file)
    leases = parse_dhcp_leases(lines)
    assert len(leases) == 2
    macs = {l.mac for l in leases}
    assert "aa:bb:cc:dd:ee:ff" in macs
    assert "11:22:33:44:55:66" in macs


def test_parse_dhcp_lease_fields(conf_file):
    lines = read_config(conf_file)
    leases = parse_dhcp_leases(lines)
    lease = next(l for l in leases if l.mac == "aa:bb:cc:dd:ee:ff")
    assert lease.ip == "192.168.1.100"
    assert lease.hostname == "laptop"
    assert lease.id == dhcp_id("aa:bb:cc:dd:ee:ff")


def test_parse_dhcp_leases_empty():
    leases = parse_dhcp_leases(["# no leases here", "address=/foo/1.2.3.4"])
    assert leases == []


def test_dhcp_id_slug():
    assert dhcp_id("aa:bb:cc:dd:ee:ff") == "aa-bb-cc-dd-ee-ff"
    assert dhcp_id("AA:BB:CC:DD:EE:FF") == "aa-bb-cc-dd-ee-ff"


# ---------------------------------------------------------------------------
# _other_lines
# ---------------------------------------------------------------------------

def test_other_lines_excludes_managed(conf_file):
    lines = read_config(conf_file)
    other = _other_lines(lines)
    for line in other:
        assert not line.strip().startswith("address=/")
        assert not line.strip().startswith("dhcp-host=")


def test_other_lines_preserves_comments(conf_file):
    lines = read_config(conf_file)
    other = _other_lines(lines)
    assert any(l.strip().startswith("#") for l in other)


def test_other_lines_preserves_directives(conf_file):
    lines = read_config(conf_file)
    other = _other_lines(lines)
    assert any("domain-needed" in l for l in other)
    assert any("dhcp-range" in l for l in other)


# ---------------------------------------------------------------------------
# write_config + round-trip
# ---------------------------------------------------------------------------

def test_write_config_round_trip(conf_file):
    dns, dhcp, other = load_all(conf_file)
    write_config(conf_file, dns, dhcp, other)

    # Re-parse
    dns2, dhcp2, other2 = load_all(conf_file)
    assert len(dns2) == len(dns)
    assert len(dhcp2) == len(dhcp)
    assert {e.hostname for e in dns2} == {e.hostname for e in dns}
    assert {l.mac for l in dhcp2} == {l.mac for l in dhcp}


def test_write_config_adds_entry(conf_file):
    dns, dhcp, other = load_all(conf_file)
    dns.append(DnsEntry(hostname="new.local", ip="10.0.0.1", id="new-local"))
    write_config(conf_file, dns, dhcp, other)

    dns2, _, _ = load_all(conf_file)
    assert any(e.hostname == "new.local" for e in dns2)


def test_write_config_removes_entry(conf_file):
    dns, dhcp, other = load_all(conf_file)
    dns = [e for e in dns if e.hostname != "router.local"]
    write_config(conf_file, dns, dhcp, other)

    dns2, _, _ = load_all(conf_file)
    assert not any(e.hostname == "router.local" for e in dns2)


def test_write_config_preserves_unrecognized_lines(conf_file):
    dns, dhcp, other = load_all(conf_file)
    write_config(conf_file, dns, dhcp, other)

    content = open(conf_file).read()
    assert "domain-needed" in content
    assert "bogus-priv" in content
    assert "dhcp-range" in content
    assert "# dnsmasq configuration" in content


def test_write_config_empty(conf_file):
    """Writing no managed entries should still preserve other lines."""
    _, _, other = load_all(conf_file)
    write_config(conf_file, [], [], other)

    dns2, dhcp2, _ = load_all(conf_file)
    assert dns2 == []
    assert dhcp2 == []
    content = open(conf_file).read()
    assert "domain-needed" in content


def test_write_config_new_file():
    with tempfile.NamedTemporaryFile(suffix=".conf", delete=False) as f:
        path = f.name
    try:
        dns = [DnsEntry(hostname="test.local", ip="1.2.3.4", id="test-local")]
        dhcp = [DhcpLease(mac="de:ad:be:ef:00:01", ip="1.2.3.5", hostname="mypc", id="de-ad-be-ef-00-01")]
        write_config(path, dns, dhcp, [])
        dns2, dhcp2, _ = load_all(path)
        assert len(dns2) == 1
        assert dns2[0].hostname == "test.local"
        assert len(dhcp2) == 1
        assert dhcp2[0].mac == "de:ad:be:ef:00:01"
    finally:
        os.unlink(path)
