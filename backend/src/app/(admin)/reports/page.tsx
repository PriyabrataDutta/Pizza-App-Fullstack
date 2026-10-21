"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button, Card, DemoNotice, EmptyState, Field, PageHeader, Table, inputCls, td, th } from "@/shared/ui";
import { toCsv } from "@/shared/format";
import { formatEuro } from "@/modules/catalog/money";
import { DEMO_DAY } from "@/shared/demo/fixtures";
import { useOrders } from "@/modules/ordering/orders-store";

export default function ReportsPage() {
  const { orders } = useOrders();
  const [from, setFrom] = useState(DEMO_DAY);
  const [to, setTo] = useState(DEMO_DAY);
  const invalid = from > to;

  const rows = useMemo(() => {
    // Dates are compared on the IST calendar day of createdAt.
    const inRange = orders.filter((o) => {
      const d = o.createdAt.slice(0, 10);
      return d >= from && d <= to && o.status !== "rejected" && o.status !== "cancelled";
    });
    const map = new Map<string, { qty: number; revenue: number }>();
    inRange.forEach((o) => o.lines.forEach((l) => {
      const cur = map.get(l.name) ?? { qty: 0, revenue: 0 };
      map.set(l.name, { qty: cur.qty + l.quantity, revenue: cur.revenue + l.lineTotalMinor });
    }));
    return { count: inRange.length, revenue: inRange.reduce((a, o) => a + o.totalMinor, 0), products: [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue) };
  }, [orders, from, to]);

  function exportCsv() {
    const csv = toCsv([["Item", "Units sold", "Revenue (INR)"], ...rows.products.map(([n, v]) => [n, v.qty, (v.revenue / 100).toFixed(2)])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `sales-by-item_${from}_to_${to}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Reports" description="Sales by item for the dates you choose." actions={<Button variant="secondary" onClick={exportCsv} disabled={invalid || rows.products.length === 0}><Download className="size-4" aria-hidden /> Export CSV</Button>} />
      <DemoNotice>Totals are calculated in the browser from the latest 200 orders received. Reports from the database will come later.</DemoNotice>
      <div className="mb-4 flex flex-wrap gap-3">
        <Field label="From">{(id) => <input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />}</Field>
        <Field label="To" error={invalid ? "Pick a date on or after the start date." : undefined}>{(id) => <input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />}</Field>
      </div>
      <dl className="mb-6 grid grid-cols-2 gap-6 rounded-card border border-line bg-surface px-5 py-4 sm:max-w-md">
        <div><dt className="text-xs text-ink-2">Orders</dt><dd className="num text-2xl font-semibold">{invalid ? "—" : rows.count}</dd></div>
        <div><dt className="text-xs text-ink-2">Revenue</dt><dd className="num text-2xl font-semibold">{invalid ? "—" : formatEuro(rows.revenue)}</dd></div>
      </dl>
      <Card>
        {invalid || rows.products.length === 0 ? (
          <EmptyState title="No sales in this range" body="Choose a different range. Cancelled and rejected orders are left out." />
        ) : (
          <Table>
            <thead><tr><th className={th}>Item</th><th className={`${th} text-right`}>Units sold</th><th className={`${th} text-right`}>Revenue</th></tr></thead>
            <tbody>{rows.products.map(([n, v]) => (
              <tr key={n}><td className={`${td} font-medium`}>{n}</td><td className={`${td} num text-right`}>{v.qty}</td><td className={`${td} num text-right`}>{formatEuro(v.revenue)}</td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
