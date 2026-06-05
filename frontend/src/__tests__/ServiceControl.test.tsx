import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceControl from "../components/ServiceControl";

vi.mock("../api", () => ({
  getServiceStatus: vi.fn(),
  runServiceAction: vi.fn(),
}));

import * as api from "../api";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getServiceStatus).mockResolvedValue({ status: "active" });
});

describe("ServiceControl", () => {
  it("shows dnsmasq status badge on mount", async () => {
    render(<ServiceControl />);
    await waitFor(() => {
      expect(screen.getByText(/dnsmasq: active/i)).toBeInTheDocument();
    });
  });

  it("shows inactive status when service is stopped", async () => {
    vi.mocked(api.getServiceStatus).mockResolvedValue({ status: "inactive" });
    render(<ServiceControl />);
    await waitFor(() => {
      expect(screen.getByText(/dnsmasq: inactive/i)).toBeInTheDocument();
    });
  });

  it("shows failed status", async () => {
    vi.mocked(api.getServiceStatus).mockResolvedValue({ status: "failed" });
    render(<ServiceControl />);
    await waitFor(() => {
      expect(screen.getByText(/dnsmasq: failed/i)).toBeInTheDocument();
    });
  });

  it("shows unknown status when API call fails", async () => {
    vi.mocked(api.getServiceStatus).mockRejectedValue(new Error("Network error"));
    render(<ServiceControl />);
    await waitFor(() => {
      expect(screen.getByText(/dnsmasq: unknown/i)).toBeInTheDocument();
    });
  });

  it("renders start, stop and restart buttons", async () => {
    render(<ServiceControl />);
    await waitFor(() => screen.getByText(/dnsmasq:/i));
    expect(screen.getByRole("button", { name: "start dnsmasq" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "stop dnsmasq" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "restart dnsmasq" })).toBeInTheDocument();
  });

  it("calls runServiceAction with 'start' when Start is clicked", async () => {
    vi.mocked(api.runServiceAction).mockResolvedValue({ status: "started" });
    render(<ServiceControl />);
    await waitFor(() => screen.getByRole("button", { name: "start dnsmasq" }));
    await userEvent.click(screen.getByRole("button", { name: "start dnsmasq" }));
    await waitFor(() => {
      expect(api.runServiceAction).toHaveBeenCalledWith("start");
    });
  });

  it("calls runServiceAction with 'stop' when Stop is clicked", async () => {
    vi.mocked(api.runServiceAction).mockResolvedValue({ status: "stopped" });
    render(<ServiceControl />);
    await waitFor(() => screen.getByRole("button", { name: "stop dnsmasq" }));
    await userEvent.click(screen.getByRole("button", { name: "stop dnsmasq" }));
    await waitFor(() => {
      expect(api.runServiceAction).toHaveBeenCalledWith("stop");
    });
  });

  it("calls runServiceAction with 'restart' when Restart is clicked", async () => {
    vi.mocked(api.runServiceAction).mockResolvedValue({ status: "restarted" });
    render(<ServiceControl />);
    await waitFor(() => screen.getByRole("button", { name: "restart dnsmasq" }));
    await userEvent.click(screen.getByRole("button", { name: "restart dnsmasq" }));
    await waitFor(() => {
      expect(api.runServiceAction).toHaveBeenCalledWith("restart");
    });
  });

  it("refreshes status after an action", async () => {
    vi.mocked(api.runServiceAction).mockResolvedValue({ status: "stopped" });
    vi.mocked(api.getServiceStatus)
      .mockResolvedValueOnce({ status: "active" })
      .mockResolvedValueOnce({ status: "inactive" });

    render(<ServiceControl />);
    await waitFor(() => screen.getByText(/dnsmasq: active/i));

    await userEvent.click(screen.getByRole("button", { name: "stop dnsmasq" }));

    await waitFor(() => {
      expect(api.getServiceStatus).toHaveBeenCalledTimes(2);
    });
  });

  it("disables buttons while an action is in progress", async () => {
    let resolve!: (v: { status: string }) => void;
    vi.mocked(api.runServiceAction).mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<ServiceControl />);
    await waitFor(() => screen.getByRole("button", { name: "start dnsmasq" }));

    await userEvent.click(screen.getByRole("button", { name: "start dnsmasq" }));

    expect(screen.getByRole("button", { name: "start dnsmasq" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "stop dnsmasq" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "restart dnsmasq" })).toBeDisabled();

    resolve({ status: "started" });
  });

  it("shows error message when action fails", async () => {
    vi.mocked(api.runServiceAction).mockRejectedValue(new Error("systemctl failed"));
    render(<ServiceControl />);
    await waitFor(() => screen.getByRole("button", { name: "start dnsmasq" }));

    await userEvent.click(screen.getByRole("button", { name: "start dnsmasq" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/systemctl failed/i)).toBeInTheDocument();
    });
  });

  it("clears error on subsequent successful action", async () => {
    vi.mocked(api.runServiceAction)
      .mockRejectedValueOnce(new Error("systemctl failed"))
      .mockResolvedValueOnce({ status: "started" });

    render(<ServiceControl />);
    await waitFor(() => screen.getByRole("button", { name: "start dnsmasq" }));

    await userEvent.click(screen.getByRole("button", { name: "start dnsmasq" }));
    await waitFor(() => screen.getByRole("alert"));

    await userEvent.click(screen.getByRole("button", { name: "restart dnsmasq" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
