"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, DemoNotice, Drawer, EmptyState, PageHeader, StatusBadge, Table, inputCls, td, th } from "@/shared/ui";
import { formatDateTime, formatMoney } from "@/shared/format";
import { customers } from "@/shared/demo/fixtures";
import { useOrders } from "@/modules/ordering/orders-store";

export default function CustomersPage() {
  const { orders } = useOrders();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const s = q.trim().toLowerCase();
  const shown = customers.filter((c) => !s || c.name.toLowerCase().includes(s) || c.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")));
  const open = customers.find((c) => c.id === openId);
  const theirs = open ? orders.filter((o) => o.customerName === open.name) : [];

  return (
    <>
      <PageHeader title="Customers" description="Look up a customer and see their recent orders." />
      <DemoNotice />
      <div className="relative mb-4 max-w-sm">
        <label htmlFor="cust-q" className="sr-only">Search customers</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
        <input id="cust-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone" className={`${inputCls} pl-9`} />
      </div>
      <Card>
        {shown.length === 0 ? <EmptyState title="No customers found" body="Check the spelling, or search by phone number." /> : (
          <Table>
            <thead><tr><th className={th}>Customer</th><th className={th}>Phone</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Total spent</th><th className={th}><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} font-medium`}>{c.name}</td>
                  <td className={`${td} num`}>{c.phone}</td>
                  <td className={`${td} num text-right`}>{c.orders}</td>
                  <td className={`${td} num text-right`}>{formatMoney(c.spentMinor)}</td>
                  <td className={`${td} text-right`}><Button variant="secondary" size="sm" onClick={() => setOpenId(c.id)}>Orders<span className="sr-only"> for {c.name}</span></Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ""}>
        {theirs.length === 0 ? <EmptyState title="No orders today" body="Earlier orders will appear here once the API is connected." /> : (
          <ul className="space-y-3">
            {theirs.map((o) => (
              <li key={o.id} className="rounded-control border border-line p-3">
                <div className="flex items-center justify-between"><span className="num font-semibold">{o.number}</span><StatusBadge status={o.status} /></div>
                <p className="num mt-1 text-xs text-ink-2">{formatDateTime(o.createdAt)} · {formatMoney(o.totalMinor)}</p>
                <p className="mt-1 text-ink-2">{o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
}
