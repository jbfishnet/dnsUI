import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DhcpTable from "../components/DhcpTable";

// Mock the api module
vi.mock("../api", () => ({
  listDhcp: vi.fn(),
  createDhcp: vi.fn(),
  updateDhcp: vi.fn(),
  deleteDhcp: vi.fn(),
}));

import * as api from "../api";

const MOCK_LEASES = [
  { id: "aa-bb-cc-dd-ee-ff", mac: "aa:bb:cc:dd:ee:ff", ip: "192.168.1.100", hostname: "laptop" },
  { id: "11-22-33-44-55-66", mac: "11:22:33:44:55:66", ip: "192.168.1.101", hostname: "desktop" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listDhcp).mockResolvedValue(MOCK_LEASES);
});

describe("DhcpTable", () => {
  it("renders DHCP leases from the API", async () => {
    render(<DhcpTable />);
    await waitFor(() => {
      expect(screen.getByText("aa:bb:cc:dd:ee:ff")).toBeInTheDocument();
      expect(screen.getByText("11:22:33:44:55:66")).toBeInTheDocument();
    });
    expect(screen.getByText("laptop")).toBeInTheDocument();
    expect(screen.getByText("desktop")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.100")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.101")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.mocked(api.listDhcp).mockReturnValue(new Promise(() => {}));
    render(<DhcpTable />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows empty state when no leases", async () => {
    vi.mocked(api.listDhcp).mockResolvedValue([]);
    render(<DhcpTable />);
    await waitFor(() => {
      expect(screen.getByText("No DHCP leases yet.")).toBeInTheDocument();
    });
  });

  it("renders edit and delete buttons for each lease", async () => {
    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));
    expect(screen.getAllByRole("button", { name: /Edit/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Delete/i })).toHaveLength(2);
  });

  it("opens Add modal when Add button is clicked", async () => {
    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));
    await userEvent.click(screen.getByRole("button", { name: /Add/i }));
    expect(screen.getByText("Add DHCP Lease")).toBeInTheDocument();
  });

  it("opens Edit modal with pre-filled values", async () => {
    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));
    await userEvent.click(screen.getByRole("button", { name: "Edit laptop" }));
    expect(screen.getByText("Edit DHCP Lease")).toBeInTheDocument();
    expect(screen.getByDisplayValue("aa:bb:cc:dd:ee:ff")).toBeInTheDocument();
    expect(screen.getByDisplayValue("192.168.1.100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("laptop")).toBeInTheDocument();
  });

  it("calls createDhcp and reloads on form submit", async () => {
    const newLease = {
      id: "de-ad-be-ef-00-01",
      mac: "de:ad:be:ef:00:01",
      ip: "192.168.1.200",
      hostname: "newdevice",
    };
    vi.mocked(api.createDhcp).mockResolvedValue(newLease);
    vi.mocked(api.listDhcp)
      .mockResolvedValueOnce(MOCK_LEASES)
      .mockResolvedValueOnce([...MOCK_LEASES, newLease]);

    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));

    await userEvent.click(screen.getByRole("button", { name: /Add/i }));
    await userEvent.clear(screen.getByLabelText("MAC Address"));
    await userEvent.type(screen.getByLabelText("MAC Address"), "de:ad:be:ef:00:01");
    await userEvent.clear(screen.getByLabelText("IP Address"));
    await userEvent.type(screen.getByLabelText("IP Address"), "192.168.1.200");
    await userEvent.clear(screen.getByLabelText("Hostname"));
    await userEvent.type(screen.getByLabelText("Hostname"), "newdevice");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.createDhcp).toHaveBeenCalledWith({
        mac: "de:ad:be:ef:00:01",
        ip: "192.168.1.200",
        hostname: "newdevice",
      });
    });
    await waitFor(() => screen.getByText("newdevice"));
  });

  it("calls updateDhcp on edit form submit", async () => {
    vi.mocked(api.updateDhcp).mockResolvedValue({
      id: "aa-bb-cc-dd-ee-ff",
      mac: "aa:bb:cc:dd:ee:ff",
      ip: "192.168.1.150",
      hostname: "laptop-updated",
    });
    vi.mocked(api.listDhcp)
      .mockResolvedValueOnce(MOCK_LEASES)
      .mockResolvedValueOnce([
        { id: "aa-bb-cc-dd-ee-ff", mac: "aa:bb:cc:dd:ee:ff", ip: "192.168.1.150", hostname: "laptop-updated" },
        MOCK_LEASES[1],
      ]);

    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));

    await userEvent.click(screen.getByRole("button", { name: "Edit laptop" }));
    const hostnameInput = screen.getByDisplayValue("laptop");
    await userEvent.clear(hostnameInput);
    await userEvent.type(hostnameInput, "laptop-updated");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateDhcp).toHaveBeenCalledWith("aa-bb-cc-dd-ee-ff", {
        mac: "aa:bb:cc:dd:ee:ff",
        ip: "192.168.1.100",
        hostname: "laptop-updated",
      });
    });
  });

  it("calls deleteDhcp when delete is confirmed", async () => {
    vi.mocked(api.deleteDhcp).mockResolvedValue(undefined);
    vi.mocked(api.listDhcp)
      .mockResolvedValueOnce(MOCK_LEASES)
      .mockResolvedValueOnce([MOCK_LEASES[0]]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DhcpTable />);
    await waitFor(() => screen.getByText("desktop"));

    await userEvent.click(screen.getByRole("button", { name: "Delete desktop" }));

    await waitFor(() => {
      expect(api.deleteDhcp).toHaveBeenCalledWith("11-22-33-44-55-66");
    });
  });

  it("does not call deleteDhcp when delete is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));

    await userEvent.click(screen.getByRole("button", { name: "Delete laptop" }));

    expect(api.deleteDhcp).not.toHaveBeenCalled();
  });

  it("closes modal when Cancel is clicked", async () => {
    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));

    await userEvent.click(screen.getByRole("button", { name: /Add/i }));
    expect(screen.getByText("Add DHCP Lease")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Add DHCP Lease")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when API call fails", async () => {
    vi.mocked(api.listDhcp).mockRejectedValue(new Error("Network error"));
    render(<DhcpTable />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("displays table headers correctly", async () => {
    render(<DhcpTable />);
    await waitFor(() => screen.getByText("laptop"));
    expect(screen.getByText("MAC Address")).toBeInTheDocument();
    expect(screen.getByText("IP Address")).toBeInTheDocument();
    expect(screen.getByText("Hostname")).toBeInTheDocument();
  });
});
