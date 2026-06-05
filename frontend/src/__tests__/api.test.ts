import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listDns, createDns, createDnsBulk, updateDns, deleteDns,
  listDhcp, createDhcp, updateDhcp, deleteDhcp,
  getServiceStatus, runServiceAction,
} from "../api";

const DNS_ENTRIES = [
  { id: "router-local", hostname: "router.local", ip: "192.168.1.1" },
  { id: "nas-local", hostname: "nas.local", ip: "192.168.1.50" },
];

const DHCP_LEASES = [
  { id: "aa-bb-cc-dd-ee-ff", mac: "aa:bb:cc:dd:ee:ff", ip: "192.168.1.100", hostname: "laptop" },
  { id: "11-22-33-44-55-66", mac: "11:22:33:44:55:66", ip: "192.168.1.101", hostname: "" },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

// ---------------------------------------------------------------------------
// DNS
// ---------------------------------------------------------------------------

describe("listDns", () => {
  it("calls GET /api/dns with relative URL", async () => {
    mockFetch(DNS_ENTRIES);
    await listDns();
    expect(fetch).toHaveBeenCalledWith("/api/dns", expect.objectContaining({
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
  });

  it("returns parsed DNS entries", async () => {
    mockFetch(DNS_ENTRIES);
    const result = await listDns();
    expect(result).toEqual(DNS_ENTRIES);
  });
});

describe("createDns", () => {
  it("calls POST /api/dns with body", async () => {
    const newEntry = { id: "new-local", hostname: "new.local", ip: "10.0.0.1" };
    mockFetch(newEntry, 201);
    await createDns({ hostname: "new.local", ip: "10.0.0.1" });
    expect(fetch).toHaveBeenCalledWith("/api/dns", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ hostname: "new.local", ip: "10.0.0.1" }),
    }));
  });

  it("throws on error response", async () => {
    mockFetch({ detail: "Already exists" }, 409);
    await expect(createDns({ hostname: "router.local", ip: "1.2.3.4" })).rejects.toThrow();
  });
});

describe("updateDns", () => {
  it("calls PUT /api/dns/:id with body", async () => {
    mockFetch({ id: "router-local", hostname: "router.local", ip: "192.168.1.254" });
    await updateDns("router-local", { hostname: "router.local", ip: "192.168.1.254" });
    expect(fetch).toHaveBeenCalledWith("/api/dns/router-local", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ hostname: "router.local", ip: "192.168.1.254" }),
    }));
  });

  it("throws on 404", async () => {
    mockFetch({ detail: "Not found" }, 404);
    await expect(updateDns("ghost", { hostname: "x", ip: "1.2.3.4" })).rejects.toThrow();
  });
});

describe("createDnsBulk", () => {
  it("calls POST /api/dns/bulk with hostnames array and ip", async () => {
    const created = [
      { id: "producer-hamq-test", hostname: "producer.hamq.test", ip: "192.168.1.22" },
      { id: "consumer-hamq-test", hostname: "consumer.hamq.test", ip: "192.168.1.22" },
    ];
    mockFetch(created, 201);
    const result = await createDnsBulk(["producer.hamq.test", "consumer.hamq.test"], "192.168.1.22");
    expect(fetch).toHaveBeenCalledWith("/api/dns/bulk", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ hostnames: ["producer.hamq.test", "consumer.hamq.test"], ip: "192.168.1.22" }),
    }));
    expect(result).toHaveLength(2);
  });

  it("throws on 409 when a hostname already exists", async () => {
    mockFetch({ detail: "DNS entry for 'router.local' already exists" }, 409);
    await expect(createDnsBulk(["router.local"], "10.0.0.1")).rejects.toThrow();
  });
});

describe("deleteDns", () => {
  it("calls DELETE /api/dns/:id", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, status: 204,
      json: () => Promise.resolve(undefined),
      text: () => Promise.resolve(""),
    } as Response);
    await deleteDns("nas-local");
    expect(fetch).toHaveBeenCalledWith("/api/dns/nas-local", expect.objectContaining({
      method: "DELETE",
    }));
  });

  it("throws on 404", async () => {
    mockFetch({ detail: "Not found" }, 404);
    await expect(deleteDns("ghost")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// DHCP
// ---------------------------------------------------------------------------

describe("listDhcp", () => {
  it("calls GET /api/dhcp with relative URL", async () => {
    mockFetch(DHCP_LEASES);
    await listDhcp();
    expect(fetch).toHaveBeenCalledWith("/api/dhcp", expect.objectContaining({
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
  });

  it("returns parsed DHCP leases", async () => {
    mockFetch(DHCP_LEASES);
    const result = await listDhcp();
    expect(result).toEqual(DHCP_LEASES);
  });

  it("handles lease with empty hostname", async () => {
    mockFetch(DHCP_LEASES);
    const result = await listDhcp();
    const noName = result.find((l) => l.mac === "11:22:33:44:55:66");
    expect(noName?.hostname).toBe("");
  });
});

describe("createDhcp", () => {
  it("calls POST /api/dhcp with body", async () => {
    const lease = { id: "de-ad-be-ef-00-01", mac: "de:ad:be:ef:00:01", ip: "192.168.1.200", hostname: "newdev" };
    mockFetch(lease, 201);
    await createDhcp({ mac: "de:ad:be:ef:00:01", ip: "192.168.1.200", hostname: "newdev" });
    expect(fetch).toHaveBeenCalledWith("/api/dhcp", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ mac: "de:ad:be:ef:00:01", ip: "192.168.1.200", hostname: "newdev" }),
    }));
  });

  it("throws on 409 duplicate", async () => {
    mockFetch({ detail: "Already exists" }, 409);
    await expect(createDhcp({ mac: "aa:bb:cc:dd:ee:ff", ip: "10.0.0.1", hostname: "dup" })).rejects.toThrow();
  });
});

describe("updateDhcp", () => {
  it("calls PUT /api/dhcp/:id with body", async () => {
    mockFetch({ id: "aa-bb-cc-dd-ee-ff", mac: "aa:bb:cc:dd:ee:ff", ip: "192.168.1.150", hostname: "laptop-new" });
    await updateDhcp("aa-bb-cc-dd-ee-ff", { mac: "aa:bb:cc:dd:ee:ff", ip: "192.168.1.150", hostname: "laptop-new" });
    expect(fetch).toHaveBeenCalledWith("/api/dhcp/aa-bb-cc-dd-ee-ff", expect.objectContaining({
      method: "PUT",
    }));
  });
});

describe("deleteDhcp", () => {
  it("calls DELETE /api/dhcp/:id", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, status: 204,
      json: () => Promise.resolve(undefined),
      text: () => Promise.resolve(""),
    } as Response);
    await deleteDhcp("aa-bb-cc-dd-ee-ff");
    expect(fetch).toHaveBeenCalledWith("/api/dhcp/aa-bb-cc-dd-ee-ff", expect.objectContaining({
      method: "DELETE",
    }));
  });
});

// ---------------------------------------------------------------------------
// Service control
// ---------------------------------------------------------------------------

describe("getServiceStatus", () => {
  it("calls GET /api/service/status", async () => {
    mockFetch({ status: "active" });
    await getServiceStatus();
    expect(fetch).toHaveBeenCalledWith("/api/service/status", expect.objectContaining({
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
  });

  it("returns the status object", async () => {
    mockFetch({ status: "active" });
    const result = await getServiceStatus();
    expect(result).toEqual({ status: "active" });
  });

  it("returns inactive status", async () => {
    mockFetch({ status: "inactive" });
    const result = await getServiceStatus();
    expect(result.status).toBe("inactive");
  });

  it("returns failed status", async () => {
    mockFetch({ status: "failed" });
    const result = await getServiceStatus();
    expect(result.status).toBe("failed");
  });

  it("throws on network error (non-2xx)", async () => {
    mockFetch({ detail: "Internal error" }, 500);
    await expect(getServiceStatus()).rejects.toThrow();
  });
});

describe("runServiceAction", () => {
  it("calls POST /api/service/start", async () => {
    mockFetch({ status: "started", service: "dnsmasq" });
    await runServiceAction("start");
    expect(fetch).toHaveBeenCalledWith("/api/service/start", expect.objectContaining({
      method: "POST",
    }));
  });

  it("calls POST /api/service/stop", async () => {
    mockFetch({ status: "stopped", service: "dnsmasq" });
    await runServiceAction("stop");
    expect(fetch).toHaveBeenCalledWith("/api/service/stop", expect.objectContaining({
      method: "POST",
    }));
  });

  it("calls POST /api/service/restart", async () => {
    mockFetch({ status: "restarted", service: "dnsmasq" });
    await runServiceAction("restart");
    expect(fetch).toHaveBeenCalledWith("/api/service/restart", expect.objectContaining({
      method: "POST",
    }));
  });

  it("returns the response body", async () => {
    mockFetch({ status: "restarted", service: "dnsmasq" });
    const result = await runServiceAction("restart");
    expect(result).toEqual({ status: "restarted", service: "dnsmasq" });
  });

  it("throws on 500 when systemctl fails", async () => {
    mockFetch({ detail: "systemctl restart dnsmasq failed" }, 500);
    await expect(runServiceAction("restart")).rejects.toThrow();
  });
});
