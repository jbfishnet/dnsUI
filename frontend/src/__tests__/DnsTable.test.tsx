import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DnsTable from "../components/DnsTable";

// Mock the api module
vi.mock("../api", () => ({
  listDns: vi.fn(),
  createDns: vi.fn(),
  updateDns: vi.fn(),
  deleteDns: vi.fn(),
}));

import * as api from "../api";

const MOCK_ENTRIES = [
  { id: "router-local", hostname: "router.local", ip: "192.168.1.1" },
  { id: "nas-local", hostname: "nas.local", ip: "192.168.1.50" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listDns).mockResolvedValue(MOCK_ENTRIES);
});

describe("DnsTable", () => {
  it("renders DNS entries from the API", async () => {
    render(<DnsTable />);
    await waitFor(() => {
      expect(screen.getByText("router.local")).toBeInTheDocument();
      expect(screen.getByText("nas.local")).toBeInTheDocument();
    });
    expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.50")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.mocked(api.listDns).mockReturnValue(new Promise(() => {}));
    render(<DnsTable />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows empty state when no entries", async () => {
    vi.mocked(api.listDns).mockResolvedValue([]);
    render(<DnsTable />);
    await waitFor(() => {
      expect(screen.getByText("No DNS entries yet.")).toBeInTheDocument();
    });
  });

  it("renders edit and delete buttons for each entry", async () => {
    render(<DnsTable />);
    await waitFor(() => screen.getByText("router.local"));
    expect(screen.getAllByRole("button", { name: /Edit/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Delete/i })).toHaveLength(2);
  });

  it("opens Add modal when Add button is clicked", async () => {
    render(<DnsTable />);
    await waitFor(() => screen.getByText("router.local"));
    await userEvent.click(screen.getByRole("button", { name: /Add/i }));
    expect(screen.getByText("Add DNS Entry")).toBeInTheDocument();
  });

  it("opens Edit modal with pre-filled values", async () => {
    render(<DnsTable />);
    await waitFor(() => screen.getByText("router.local"));
    await userEvent.click(screen.getByRole("button", { name: "Edit router.local" }));
    expect(screen.getByText("Edit DNS Entry")).toBeInTheDocument();
    expect(screen.getByDisplayValue("router.local")).toBeInTheDocument();
    expect(screen.getByDisplayValue("192.168.1.1")).toBeInTheDocument();
  });

  it("calls createDns and reloads on form submit", async () => {
    vi.mocked(api.createDns).mockResolvedValue({
      id: "new-local",
      hostname: "new.local",
      ip: "10.0.0.1",
    });
    const updatedEntries = [
      ...MOCK_ENTRIES,
      { id: "new-local", hostname: "new.local", ip: "10.0.0.1" },
    ];
    vi.mocked(api.listDns)
      .mockResolvedValueOnce(MOCK_ENTRIES)
      .mockResolvedValueOnce(updatedEntries);

    render(<DnsTable />);
    await waitFor(() => screen.getByText("router.local"));

    await userEvent.click(screen.getByRole("button", { name: /Add/i }));
    await userEvent.clear(screen.getByLabelText("Hostname"));
    await userEvent.type(screen.getByLabelText("Hostname"), "new.local");
    await userEvent.clear(screen.getByLabelText("IP Address"));
    await userEvent.type(screen.getByLabelText("IP Address"), "10.0.0.1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.createDns).toHaveBeenCalledWith({
        hostname: "new.local",
        ip: "10.0.0.1",
      });
    });
    await waitFor(() => screen.getByText("new.local"));
  });

  it("calls updateDns on edit form submit", async () => {
    vi.mocked(api.updateDns).mockResolvedValue({
      id: "router-local",
      hostname: "router.local",
      ip: "192.168.1.254",
    });
    vi.mocked(api.listDns)
      .mockResolvedValueOnce(MOCK_ENTRIES)
      .mockResolvedValueOnce([
        { id: "router-local", hostname: "router.local", ip: "192.168.1.254" },
        MOCK_ENTRIES[1],
      ]);

    render(<DnsTable />);
    await waitFor(() => screen.getByText("router.local"));

    await userEvent.click(screen.getByRole("button", { name: "Edit router.local" }));
    const ipInput = screen.getByDisplayValue("192.168.1.1");
    await userEvent.clear(ipInput);
    await userEvent.type(ipInput, "192.168.1.254");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateDns).toHaveBeenCalledWith("router-local", {
        hostname: "router.local",
        ip: "192.168.1.254",
      });
    });
  });

  it("calls deleteDns when delete is confirmed", async () => {
    vi.mocked(api.deleteDns).mockResolvedValue(undefined);
    vi.mocked(api.listDns)
      .mockResolvedValueOnce(MOCK_ENTRIES)
      .mockResolvedValueOnce([MOCK_ENTRIES[0]]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DnsTable />);
    await waitFor(() => screen.getByText("nas.local"));

    await userEvent.click(screen.getByRole("button", { name: "Delete nas.local" }));

    await waitFor(() => {
      expect(api.deleteDns).toHaveBeenCalledWith("nas-local");
    });
  });

  it("does not call deleteDns when delete is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<DnsTable />);
    await waitFor(() => screen.getByText("nas.local"));

    await userEvent.click(screen.getByRole("button", { name: "Delete nas.local" }));

    expect(api.deleteDns).not.toHaveBeenCalled();
  });

  it("closes modal when Cancel is clicked", async () => {
    render(<DnsTable />);
    await waitFor(() => screen.getByText("router.local"));

    await userEvent.click(screen.getByRole("button", { name: /Add/i }));
    expect(screen.getByText("Add DNS Entry")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Add DNS Entry")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when API call fails", async () => {
    vi.mocked(api.listDns).mockRejectedValue(new Error("Network error"));
    render(<DnsTable />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
