"""
Parser for dnsmasq.conf files.

Managed line formats:
  address=/hostname/ip     -> DNS entry
  dhcp-host=mac,ip,hostname -> DHCP static lease

All other lines (comments, blank lines, other directives) are preserved as-is.
"""
from __future__ import annotations

import re
from typing import List, Tuple

from .models import DhcpLease, DnsEntry


# ---------------------------------------------------------------------------
# ID helpers
# ---------------------------------------------------------------------------

def _slug(value: str) -> str:
    """Convert a string to a URL-safe slug."""
    slug = value.lower()
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug.strip("-")


def dns_id(hostname: str) -> str:
    return _slug(hostname)


def dhcp_id(mac: str) -> str:
    return _slug(mac)


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def read_config(path: str) -> List[str]:
    """Read the config file and return its lines (with newlines stripped)."""
    try:
        with open(path, "r") as fh:
            return fh.read().splitlines()
    except FileNotFoundError:
        return []


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

_DNS_RE = re.compile(r"^address=/([^/]+)/([^/\s]+)\s*$")
_DHCP_RE = re.compile(
    r"^dhcp-host=([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}),([^,\s]+),([^,\s]+)\s*$"
)


def parse_dns_entries(lines: List[str]) -> List[DnsEntry]:
    """Return all DNS address entries found in *lines*."""
    entries: List[DnsEntry] = []
    for line in lines:
        m = _DNS_RE.match(line.strip())
        if m:
            hostname, ip = m.group(1), m.group(2)
            entries.append(DnsEntry(hostname=hostname, ip=ip, id=dns_id(hostname)))
    return entries


def parse_dhcp_leases(lines: List[str]) -> List[DhcpLease]:
    """Return all DHCP static lease entries found in *lines*."""
    leases: List[DhcpLease] = []
    for line in lines:
        m = _DHCP_RE.match(line.strip())
        if m:
            mac, ip, hostname = m.group(1), m.group(2), m.group(3)
            leases.append(
                DhcpLease(mac=mac, ip=ip, hostname=hostname, id=dhcp_id(mac))
            )
    return leases


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def _other_lines(lines: List[str]) -> List[str]:
    """Return lines that are neither DNS address entries nor DHCP host entries."""
    result = []
    for line in lines:
        stripped = line.strip()
        if _DNS_RE.match(stripped) or _DHCP_RE.match(stripped):
            continue
        result.append(line)
    return result


def write_config(
    path: str,
    dns_entries: List[DnsEntry],
    dhcp_leases: List[DhcpLease],
    other_lines: List[str],
) -> None:
    """
    Write a complete dnsmasq.conf.

    Structure:
      1. All preserved (non-managed) lines
      2. A blank line separator (if there are managed entries)
      3. DNS address directives
      4. DHCP host directives
    """
    parts: List[str] = list(other_lines)

    # Remove trailing blank lines from the preserved section so we can add our own
    while parts and parts[-1].strip() == "":
        parts.pop()

    managed: List[str] = []
    for entry in dns_entries:
        managed.append(f"address=/{entry.hostname}/{entry.ip}")
    for lease in dhcp_leases:
        managed.append(f"dhcp-host={lease.mac},{lease.ip},{lease.hostname}")

    if managed:
        if parts:
            parts.append("")  # blank separator
        parts.extend(managed)

    with open(path, "w") as fh:
        fh.write("\n".join(parts))
        if parts:
            fh.write("\n")


# ---------------------------------------------------------------------------
# High-level helpers used by routes
# ---------------------------------------------------------------------------

def load_all(
    path: str,
) -> Tuple[List[DnsEntry], List[DhcpLease], List[str]]:
    """Return (dns_entries, dhcp_leases, other_lines) for the given config file."""
    lines = read_config(path)
    dns = parse_dns_entries(lines)
    dhcp = parse_dhcp_leases(lines)
    other = _other_lines(lines)
    return dns, dhcp, other
