import { useState } from "react";
import Layout from "./components/Layout";
import DnsTable from "./components/DnsTable";
import DhcpTable from "./components/DhcpTable";

export type Tab = "dns" | "dhcp";

export default function App() {
  const [tab, setTab] = useState<Tab>("dns");

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      {tab === "dns" ? <DnsTable /> : <DhcpTable />}
    </Layout>
  );
}
