// Default to "" (relative) so nginx proxies /api/* to the backend.
// Override with VITE_API_URL at build time for standalone dev (e.g. VITE_API_URL=http://localhost:8000).
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface DnsEntry {
  id: string;
  hostname: string;
  ip: string;
}

export interface DhcpLease {
  id: string;
  mac: string;
  ip: string;
  hostname: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(body || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// DNS
export const listDns = (): Promise<DnsEntry[]> =>
  request<DnsEntry[]>("/api/dns");

export const createDns = (entry: Omit<DnsEntry, "id">): Promise<DnsEntry> =>
  request<DnsEntry>("/api/dns", { method: "POST", body: JSON.stringify(entry) });

export const updateDns = (id: string, entry: Omit<DnsEntry, "id">): Promise<DnsEntry> =>
  request<DnsEntry>(`/api/dns/${id}`, { method: "PUT", body: JSON.stringify(entry) });

export const deleteDns = (id: string): Promise<void> =>
  request<void>(`/api/dns/${id}`, { method: "DELETE" });

export const createDnsBulk = (hostnames: string[], ip: string): Promise<DnsEntry[]> =>
  request<DnsEntry[]>("/api/dns/bulk", { method: "POST", body: JSON.stringify({ hostnames, ip }) });

// DHCP
export const listDhcp = (): Promise<DhcpLease[]> =>
  request<DhcpLease[]>("/api/dhcp");

export const createDhcp = (lease: Omit<DhcpLease, "id">): Promise<DhcpLease> =>
  request<DhcpLease>("/api/dhcp", { method: "POST", body: JSON.stringify(lease) });

export const updateDhcp = (id: string, lease: Omit<DhcpLease, "id">): Promise<DhcpLease> =>
  request<DhcpLease>(`/api/dhcp/${id}`, { method: "PUT", body: JSON.stringify(lease) });

export const deleteDhcp = (id: string): Promise<void> =>
  request<void>(`/api/dhcp/${id}`, { method: "DELETE" });

// Service
export type ServiceStatus = "active" | "inactive" | "failed" | "unknown";
export type ServiceAction = "start" | "stop" | "restart";

export const getServiceStatus = (): Promise<{ status: ServiceStatus }> =>
  request<{ status: ServiceStatus }>("/api/service/status");

export const runServiceAction = (action: ServiceAction): Promise<{ status: string }> =>
  request<{ status: string }>(`/api/service/${action}`, { method: "POST" });
