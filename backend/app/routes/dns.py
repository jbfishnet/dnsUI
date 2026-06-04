from fastapi import APIRouter, HTTPException

from ..config import DNSMASQ_CONF
from ..models import DnsEntry
from ..parser import dns_id, load_all, write_config
from .._restart import restart_dnsmasq

router = APIRouter(prefix="/api/dns", tags=["dns"])


@router.get("", response_model=list[DnsEntry])
def list_dns():
    dns_entries, _, _ = load_all(DNSMASQ_CONF)
    return dns_entries


@router.post("", response_model=DnsEntry, status_code=201)
def create_dns(entry: DnsEntry):
    dns_entries, dhcp_leases, other_lines = load_all(DNSMASQ_CONF)

    entry.id = dns_id(entry.hostname)

    # Check for duplicate
    if any(e.id == entry.id for e in dns_entries):
        raise HTTPException(status_code=409, detail=f"DNS entry for '{entry.hostname}' already exists")

    dns_entries.append(entry)
    write_config(DNSMASQ_CONF, dns_entries, dhcp_leases, other_lines)
    restart_dnsmasq()
    return entry


@router.put("/{entry_id}", response_model=DnsEntry)
def update_dns(entry_id: str, entry: DnsEntry):
    dns_entries, dhcp_leases, other_lines = load_all(DNSMASQ_CONF)

    idx = next((i for i, e in enumerate(dns_entries) if e.id == entry_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"DNS entry '{entry_id}' not found")

    entry.id = dns_id(entry.hostname)
    dns_entries[idx] = entry
    write_config(DNSMASQ_CONF, dns_entries, dhcp_leases, other_lines)
    restart_dnsmasq()
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_dns(entry_id: str):
    dns_entries, dhcp_leases, other_lines = load_all(DNSMASQ_CONF)

    original_len = len(dns_entries)
    dns_entries = [e for e in dns_entries if e.id != entry_id]
    if len(dns_entries) == original_len:
        raise HTTPException(status_code=404, detail=f"DNS entry '{entry_id}' not found")

    write_config(DNSMASQ_CONF, dns_entries, dhcp_leases, other_lines)
    restart_dnsmasq()
