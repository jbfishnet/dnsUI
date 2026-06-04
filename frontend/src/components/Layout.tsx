import { ReactNode } from "react";
import { Tab } from "../App";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

export default function Layout({ activeTab, onTabChange, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-indigo-700 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <svg
            className="w-6 h-6 text-indigo-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M12 5l7 7-7 7"
            />
          </svg>
          <h1 className="text-xl font-bold text-white tracking-tight">
            dnsmasq Manager
          </h1>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex gap-1 border-b border-gray-200">
          {(["dns", "dhcp"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${
                activeTab === t
                  ? "bg-white border border-b-white border-gray-200 text-indigo-700 -mb-px"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t === "dns" ? "DNS Entries" : "DHCP Leases"}
            </button>
          ))}
        </div>

        {/* Page content */}
        <div className="bg-white border border-t-0 border-gray-200 rounded-b shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
