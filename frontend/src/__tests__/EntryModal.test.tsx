import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EntryModal, { FieldConfig } from "../components/EntryModal";

const FIELDS: FieldConfig[] = [
  { name: "hostname", label: "Hostname", placeholder: "device.local" },
  { name: "ip", label: "IP Address", placeholder: "192.168.1.1" },
];

const MULTILINE_FIELDS: FieldConfig[] = [
  { name: "hostnames", label: "Hostname(s)", placeholder: "a.local\nb.local", multiline: true, hint: "One per line" },
  { name: "ip", label: "IP Address", placeholder: "192.168.1.1" },
];

function renderModal(overrides: Partial<Parameters<typeof EntryModal>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <EntryModal
      title="Test Modal"
      fields={FIELDS}
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSubmit, onClose };
}

describe("EntryModal", () => {
  describe("rendering", () => {
    it("renders title", () => {
      renderModal();
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
    });

    it("renders all fields with labels", () => {
      renderModal();
      expect(screen.getByLabelText("Hostname")).toBeInTheDocument();
      expect(screen.getByLabelText("IP Address")).toBeInTheDocument();
    });

    it("renders hint text when provided", () => {
      renderModal({ fields: MULTILINE_FIELDS });
      expect(screen.getByText("One per line")).toBeInTheDocument();
    });

    it("pre-fills fields with initialValues", () => {
      renderModal({ initialValues: { hostname: "router.local", ip: "192.168.1.1" } });
      expect(screen.getByDisplayValue("router.local")).toBeInTheDocument();
      expect(screen.getByDisplayValue("192.168.1.1")).toBeInTheDocument();
    });

    it("renders multiline textarea when field.multiline is true", () => {
      renderModal({ fields: MULTILINE_FIELDS });
      expect(screen.getByRole("textbox", { name: "Hostname(s)" }).tagName).toBe("TEXTAREA");
    });

    it("renders copy button for each field", () => {
      renderModal();
      expect(screen.getAllByRole("button", { name: /copy to clipboard/i })).toHaveLength(2);
    });

    it("renders Save and Cancel buttons", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("close behaviour", () => {
    it("calls onClose when Cancel is clicked", async () => {
      const { onClose } = renderModal();
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when X button is clicked", async () => {
      const { onClose } = renderModal();
      await userEvent.click(screen.getByRole("button", { name: /close/i }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when clicking the backdrop", async () => {
      const { onClose } = renderModal();
      // The backdrop is the outermost div with the overlay class
      const backdrop = document.querySelector("[class*='fixed'][class*='inset-0']") as HTMLElement;
      fireEvent.click(backdrop, { target: backdrop });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when Escape key is pressed", async () => {
      const { onClose } = renderModal();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("form submission", () => {
    it("calls onSubmit with field values", async () => {
      const { onSubmit } = renderModal({
        initialValues: { hostname: "device.local", ip: "10.0.0.1" },
      });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ hostname: "device.local", ip: "10.0.0.1" });
      });
    });

    it("closes modal after successful submit", async () => {
      const { onClose } = renderModal({
        initialValues: { hostname: "device.local", ip: "10.0.0.1" },
      });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    });

    it("shows error message when onSubmit throws", async () => {
      const { onSubmit } = renderModal({
        initialValues: { hostname: "device.local", ip: "10.0.0.1" },
      });
      onSubmit.mockRejectedValue(new Error("Save failed"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Save failed")).toBeInTheDocument();
      });
    });

    it("shows Saving… while submitting", async () => {
      let resolve!: () => void;
      const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r; }));
      const onClose = vi.fn();
      render(
        <EntryModal
          title="Test Modal"
          fields={FIELDS}
          initialValues={{ hostname: "device.local", ip: "10.0.0.1" }}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      );
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
      resolve();
    });

    it("disables Save button while submitting", async () => {
      let resolve!: () => void;
      const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r; }));
      render(
        <EntryModal
          title="Test Modal"
          fields={FIELDS}
          initialValues={{ hostname: "device.local", ip: "10.0.0.1" }}
          onSubmit={onSubmit}
          onClose={vi.fn()}
        />
      );
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
      resolve();
    });

    it("does not close on submit error", async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error("fail"));
      const onClose = vi.fn();
      render(
        <EntryModal
          title="Test Modal"
          fields={FIELDS}
          initialValues={{ hostname: "device.local", ip: "10.0.0.1" }}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      );
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => screen.getByRole("alert"));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("copy button", () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
    });

    it("copies field value to clipboard when copy button is clicked", async () => {
      renderModal({ initialValues: { hostname: "router.local", ip: "192.168.1.1" } });
      const copyButtons = screen.getAllByRole("button", { name: /copy to clipboard/i });
      await userEvent.click(copyButtons[0]);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("router.local");
    });

    it("shows Copied! tooltip after clicking copy", async () => {
      renderModal({ initialValues: { hostname: "router.local", ip: "192.168.1.1" } });
      const copyButtons = screen.getAllByRole("button", { name: /copy to clipboard/i });
      await userEvent.click(copyButtons[0]);
      await waitFor(() => {
        expect(screen.getByTitle("Copied!")).toBeInTheDocument();
      });
    });
  });
});
