"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "@/shared/ui";
import { formatTime } from "@/shared/format";
import { formatEuro } from "@/modules/catalog/money";
import { CLOSED_STATUSES, primaryTransition } from "./domain";
import { OrderDrawer } from "./order-drawer";
import { OrdersStatus } from "./orders-status";
import { useOrders } from "./orders-store";

const berlinDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const isToday = (iso: string) => berlinDay(new Date(iso)) === berlinDay(new Date());

export function OverviewView() {
  const { orders, transition, busy } = useOrders();
  const manage = useAccess().canManage("orders");
  const [openId, setOpenId] = useState<string | null>(null);

  const s = useMemo(() => {
    // The figures are for today; the queue below is every order that still needs someone, whatever day it came in.
    const todays = orders.filter((o) => isToday(o.createdAt));
    const live = todays.filter((o) => o.status !== "rejected" && o.status !== "cancelled");
    const revenue = live.reduce((a, o) => a + o.totalMinor, 0);
    const byProduct = new Map<string, number>();
    live.forEach((o) => o.lines.forEach((l) => byProduct.set(l.name, (byProduct.get(l.name) ?? 0) + l.lineTotalMinor)));
    const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      total: todays.length,
      revenue,
      pending: orders.filter((o) => o.status === "placed").length,
      inKitchen: orders.filter((o) => ["accepted", "preparing", "ready_for_dispatch", "out_for_delivery"].includes(o.status)).length,
      done: todays.filter((o) => o.status === "delivered").length,
      queue: orders.filter((o) => !CLOSED_STATUSES.includes(o.status) && o.status !== "out_for_delivery").slice(0, 6),
      recent: orders.slice(0, 6),
      top,
      topMax: Math.max(1, ...top.map((t) => t[1])),
    };
  }, [orders]);

  const open = orders.find((o) => o.id === openId) ?? null;

  return (
    <>
      <PageHeader title="Overview" description="What needs doing right now, and how today is going." actions={<Link href="/orders"><Button variant="secondary">Open order board</Button></Link>} />
      <OrdersStatus />

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-xl font-semibold">Needs your attention</h2>
          <span className="num text-ink-2">{s.pending} waiting to be accepted</span>
        </div>
        {s.queue.length === 0 ? (
          <EmptyState title="All caught up" body="New orders will show up here as soon as customers place them." />
        ) : (
          <ul className="divide-y divide-line">
            {s.queue.map((o) => {
              const next = primaryTransition(o.status);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <button onClick={() => setOpenId(o.id)} className="flex min-w-0 flex-1 basis-60 items-center gap-4 text-left" aria-label={`Open order ${o.number}`}>
                    <span className="num w-20 shrink-0 font-bold">{o.number}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.customerName}</span>
                      <span className="block truncate text-xs text-ink-2">{o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}</span>
                    </span>
                  </button>
                  <span className="num text-xs text-ink-2">{formatTime(o.createdAt)}</span>
                  <StatusBadge status={o.status} />
                  <span className="num w-24 text-right font-semibold">{formatEuro(o.totalMinor)}</span>
                  {next && manage && <Button size="sm" loading={busy.has(o.id)} onClick={() => transition(o.id, next.to)}>{next.label}</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-card border border-line bg-surface px-5 py-4 md:grid-cols-4">
        {[
          ["Orders today", String(s.total)],
          ["Revenue today", formatEuro(s.revenue)],
          ["In progress", String(s.inKitchen)],
          ["Delivered", String(s.done)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-2">{k}</dt>
            <dd className="num mt-0.5 text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-xl font-semibold">Top sellers today</h2>
          <ul className="space-y-3">
            {s.top.map(([name, v]) => (
              <li key={name}>
                <div className="mb-1 flex justify-between gap-3"><span>{name}</span><span className="num font-medium">{formatEuro(v)}</span></div>
                <div className="h-2 rounded-full bg-subtle" role="presentation"><div className="h-2 rounded-full bg-brand" style={{ width: `${(v / s.topMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-2">Revenue by item, excluding rejected and cancelled orders.</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-xl font-semibold">Recent orders</h2>
            <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:underline">View all <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {s.recent.map((o) => (
              <li key={o.id}>
                <button onClick={() => setOpenId(o.id)} className="flex w-full min-h-14 items-center gap-3 px-5 py-2 text-left hover:bg-subtle/60">
                  <span className="num w-20 shrink-0 font-semibold">{o.number}</span>
                  <span className="min-w-0 flex-1 truncate">{o.customerName}</span>
                  <StatusBadge status={o.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <OrderDrawer order={open} onClose={() => setOpenId(null)} />
    </>
  );
}
