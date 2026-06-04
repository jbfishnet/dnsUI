from fastapi import APIRouter, HTTPException

from ..config import DNSMASQ_CONF
from ..models import DhcpLease
from ..parser import dhcp_id, load_all, write_config
from .._restart import restart_dnsmasq

router = APIRouter(prefix="/api/dhcp", tags=["dhcp"])


@router.get("", response_model=list[DhcpLease])
def list_dhcp():
    _, dhcp_leases, _ = load_all(DNSMASQ_CONF)
    return dhcp_leases


@router.post("", response_model=DhcpLease, status_code=201)
def create_dhcp(lease: DhcpLease):
    dns_entries, dhcp_leases, other_lines = load_all(DNSMASQ_CONF)

    lease.id = dhcp_id(lease.mac)

    if any(l.id == lease.id for l in dhcp_leases):
        raise HTTPException(status_code=409, detail=f"DHCP lease for MAC '{lease.mac}' already exists")

    dhcp_leases.append(lease)
    write_config(DNSMASQ_CONF, dns_entries, dhcp_leases, other_lines)
    restart_dnsmasq()
    return lease


@router.put("/{lease_id}", response_model=DhcpLease)
def update_dhcp(lease_id: str, lease: DhcpLease):
    dns_entries, dhcp_leases, other_lines = load_all(DNSMASQ_CONF)

    idx = next((i for i, l in enumerate(dhcp_leases) if l.id == lease_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"DHCP lease '{lease_id}' not found")

    lease.id = dhcp_id(lease.mac)
    dhcp_leases[idx] = lease
    write_config(DNSMASQ_CONF, dns_entries, dhcp_leases, other_lines)
    restart_dnsmasq()
    return lease


@router.delete("/{lease_id}", status_code=204)
def delete_dhcp(lease_id: str):
    dns_entries, dhcp_leases, other_lines = load_all(DNSMASQ_CONF)

    original_len = len(dhcp_leases)
    dhcp_leases = [l for l in dhcp_leases if l.id != lease_id]
    if len(dhcp_leases) == original_len:
        raise HTTPException(status_code=404, detail=f"DHCP lease '{lease_id}' not found")

    write_config(DNSMASQ_CONF, dns_entries, dhcp_leases, other_lines)
    restart_dnsmasq()
