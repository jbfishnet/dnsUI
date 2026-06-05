import { useState, useEffect, useCallback } from "react";
import { getServiceStatus, runServiceAction, ServiceStatus } from "../api";

const STATUS_STYLE: Record<ServiceStatus, string> = {
  active:   "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  failed:   "bg-red-100 text-red-700",
  unknown:  "bg-yellow-100 text-yellow-700",
};

const STATUS_DOT: Record<ServiceStatus, string> = {
  active:   "bg-green-500",
  inactive: "bg-gray-400",
  failed:   "bg-red-500",
  unknown:  "bg-yellow-500",
};

export default function ServiceControl() {
  const [status, setStatus] = useState<ServiceStatus>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { status: s } = await getServiceStatus();
      setStatus(s);
    } catch {
      setStatus("unknown");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handle(action: "start" | "stop" | "restart") {
    setBusy(true);
    setError(null);
    try {
      await runServiceAction(action);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status badge */}
      <span
        aria-label={`dnsmasq status: ${status}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[status]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
        dnsmasq: {status}
      </span>

      {/* Action buttons */}
      {(["start", "stop", "restart"] as const).map((action) => (
        <button
          key={action}
          onClick={() => handle(action)}
          disabled={busy}
          aria-label={`${action} dnsmasq`}
          className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-800 text-indigo-100 hover:bg-indigo-600 disabled:opacity-50 transition-colors capitalize"
        >
          {action}
        </button>
      ))}

      {error && (
        <span className="text-xs text-red-300" role="alert">{error}</span>
      )}
    </div>
  );
}
