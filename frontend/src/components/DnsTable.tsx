import { useState, useEffect, useCallback } from "react";
import { DnsEntry, listDns, createDns, updateDns, deleteDns } from "../api";
import EntryModal, { FieldConfig } from "./EntryModal";
import Toast from "./Toast";

const DNS_FIELDS: FieldConfig[] = [
  { name: "hostname", label: "Hostname", placeholder: "mydevice.local" },
  { name: "ip", label: "IP Address", placeholder: "192.168.1.100" },
];

export default function DnsTable() {
  const [entries, setEntries] = useState<DnsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DnsEntry | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await listDns());
    } catch {
      setToast({ message: "Failed to load DNS entries", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
  }

  async function handleCreate(values: Record<string, string>) {
    await createDns({ hostname: values.hostname, ip: values.ip });
    showToast("DNS entry created", "success");
    await load();
  }

  async function handleUpdate(values: Record<string, string>) {
    if (!editing) return;
    await updateDns(editing.id, { hostname: values.hostname, ip: values.ip });
    showToast("DNS entry updated", "success");
    await load();
  }

  async function handleDelete(entry: DnsEntry) {
    if (!confirm(`Delete DNS entry for "${entry.hostname}"?`)) return;
    try {
      await deleteDns(entry.id);
      showToast("DNS entry deleted", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-700">
          DNS Entries
          <span className="ml-2 text-xs font-normal text-gray-400">
            (address=/hostname/ip)
          </span>
        </h2>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No DNS entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Hostname</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">IP Address</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-800">{entry.hostname}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{entry.ip}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditing(entry); setModalOpen(true); }}
                        aria-label={`Edit ${entry.hostname}`}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        aria-label={`Delete ${entry.hostname}`}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <EntryModal
          title={editing ? "Edit DNS Entry" : "Add DNS Entry"}
          fields={DNS_FIELDS}
          initialValues={editing ? { hostname: editing.hostname, ip: editing.ip } : undefined}
          onSubmit={editing ? handleUpdate : handleCreate}
          onClose={() => setModalOpen(false)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
