from pydantic import BaseModel


class DnsEntry(BaseModel):
    hostname: str
    ip: str
    id: str | None = None  # generated from hostname


class DhcpLease(BaseModel):
    mac: str
    ip: str
    hostname: str
    id: str | None = None  # generated from mac
