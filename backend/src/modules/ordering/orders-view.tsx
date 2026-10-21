"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, DemoNotice, ReadOnlyNotice, EmptyState, PageHeader, StatusBadge, Table, td, th, inputCls } from "@/shared/ui";
import { formatMoney, formatTime } from "@/shared/format";
import { BOARD_STAGES, STATUS_META, type OrderStatus } from "./domain";
import { OrderDrawer } from "./order-drawer";
import { OrderTicket } from "./order-ticket";
import { useOrders } from "./orders-store";

const PAGE = 8;

export function OrdersView() {
  const { orders, transition } = useOrders();
  const manage = useAccess().canManage("orders");
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (!s || o.number.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.customerPhone.replace(/\s/g, "").includes(s.replace(/\s/g, ""))),
    );
  }, [orders, q, status]);

  const open = orders.find((o) => o.id === openId) ?? null;
  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const rows = matches.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <PageHeader
        title="Orders"
        description="New orders land on the left. Move each one along as the kitchen works."
        actions={
          <div role="group" aria-label="View" className="inline-flex rounded-control border border-line bg-surface p-0.5">
            {([["board", "Board", LayoutGrid], ["list", "List", List]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-sm font-medium ${view === v ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"}`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        }
      />
      {!manage && <ReadOnlyNotice />}
      <DemoNotice>Seeded demo orders. Status changes work here but are not saved to the database yet.</DemoNotice>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <label htmlFor="order-search" className="sr-only">Search orders</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
          <input id="order-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search by order number, name or phone" className={`${inputCls} pl-9`} />
        </div>
        {view === "list" && (
          <div>
            <label htmlFor="order-status" className="sr-only">Filter by status</label>
            <select id="order-status" value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | "all"); setPage(0); }} className={inputCls}>
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
        )}
      </div>

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
          <div className="flex min-w-max gap-4">
            {BOARD_STAGES.map((stage) => {
              const inLane = matches.filter((o) => o.status === stage);
              return (
                <section key={stage} aria-labelledby={`lane-${stage}`} className="w-[272px] shrink-0 rounded-feature bg-subtle p-3">
                  <h2 id={`lane-${stage}`} className="mb-3 flex items-center justify-between px-1">
                    <span className="text-sm font-semibold">{STATUS_META[stage].label}</span>
                    <span className="num rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-2">{inLane.length}</span>
                  </h2>
                  {inLane.length === 0 ? (
                    <p className="rounded-control border border-dashed border-line px-3 py-6 text-center text-xs text-ink-2">Nothing here right now.</p>
                  ) : (
                    <ul className="space-y-3">
                      {inLane.map((o) => <OrderTicket key={o.id} order={o} onOpen={setOpenId} onAdvance={manage ? transition : undefined} />)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-2">Rejected and cancelled orders appear in the list view.</p>
        </div>
      ) : (
        <Card>
          {matches.length === 0 ? (
            <EmptyState title="No orders match" body="Try a different order number, name or status." action={<Button variant="secondary" onClick={() => { setQ(""); setStatus("all"); }}>Clear filters</Button>} />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Placed</th>
                    <th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={th}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-subtle/50">
                      <td className={`${td} num font-semibold`}>{o.number}</td>
                      <td className={td}>{o.customerName}<span className="num block text-xs text-ink-2">{o.customerPhone}</span></td>
                      <td className={`${td} num`}>{formatTime(o.createdAt)}</td>
                      <td className={td}><StatusBadge status={o.status} /></td>
                      <td className={`${td} num text-right font-semibold`}>{formatMoney(o.totalMinor)}</td>
                      <td className={`${td} text-right`}><Button variant="secondary" size="sm" onClick={() => setOpenId(o.id)}>View<span className="sr-only"> {o.number}</span></Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="num text-xs text-ink-2">Page {page + 1} of {pages} · {matches.length} orders</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="secondary" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      <OrderDrawer order={open} onClose={() => setOpenId(null)} />
    </>
  );
}
