from pydantic import BaseModel


class DnsEntry(BaseModel):
    hostname: str
    ip: str
    id: str | None = None  # generated from hostname


class BulkDnsCreate(BaseModel):
    hostnames: list[str]
    ip: str


class DhcpLease(BaseModel):
    mac: str
    ip: str
    hostname: str = ""  # optional — dnsmasq allows dhcp-host=mac,ip without a name
    id: str | None = None  # generated from mac
