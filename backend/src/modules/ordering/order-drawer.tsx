"use client";

import { useState } from "react";
import { Button, Drawer, Field, StatusBadge, inputCls } from "@/shared/ui";
import { formatDateTime, formatMoney } from "@/shared/format";
import { nextTransitions, STATUS_META, type Order, type Transition } from "./domain";
import { useAccess } from "@/modules/access/access-context";
import { PaymentPill } from "./order-ticket";
import { useOrders } from "./orders-store";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-line pt-2 text-base font-bold" : ""}`}>
      <dt className={strong ? "" : "text-ink-2"}>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

export function OrderDrawer({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { transition } = useOrders();
  const manage = useAccess().canManage("orders");
  const [pending, setPending] = useState<Transition | null>(null);
  const [reason, setReason] = useState("");

  const actions = order && manage ? nextTransitions(order.status) : [];

  function apply(t: Transition) {
    if (!order) return;
    if (t.destructive) {
      setPending(t);
      return;
    }
    transition(order.id, t.to);
  }
  function confirm() {
    if (!order || !pending) return;
    transition(order.id, pending.to, reason.trim() || undefined);
    setPending(null);
    setReason("");
  }

  return (
    <>
      <Drawer
        open={!!order}
        onClose={onClose}
        title={order ? `Order ${order.number}` : ""}
        footer={
          order && actions.length > 0 ? (
            <>
              {actions.filter((a) => a.destructive).map((a) => (
                <Button key={a.to} variant="danger" onClick={() => apply(a)}>{a.label}</Button>
              ))}
              {actions.filter((a) => !a.destructive).map((a) => (
                <Button key={a.to} onClick={() => apply(a)}>{a.label}</Button>
              ))}
            </>
          ) : undefined
        }
      >
        {order && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              <PaymentPill order={order} />
            </div>

            <section>
              <h3 className="mb-1 text-base font-semibold">Customer</h3>
              <p className="font-medium">{order.customerName}</p>
              <p className="num text-ink-2">{order.customerPhone}</p>
              <p className="mt-1">{order.address}</p>
              {order.instructions && <p className="mt-1 text-warning">Note: {order.instructions}</p>}
            </section>

            <section>
              <h3 className="mb-2 text-base font-semibold">Items</h3>
              <ul className="divide-y divide-line rounded-control border border-line">
                {order.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 p-3">
                    <div>
                      <p><span className="num font-semibold">{l.quantity}×</span> {l.name} <span className="text-ink-2">({l.variant})</span></p>
                      {l.options.length > 0 && <p className="text-xs text-ink-2">{l.options.join(", ")}</p>}
                    </div>
                    <span className="num">{formatMoney(l.lineTotalMinor)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-base font-semibold">Price</h3>
              <dl className="space-y-1.5">
                <Row label="Subtotal" value={formatMoney(order.subtotalMinor)} />
                {order.discountMinor > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${formatMoney(order.discountMinor)}`} />}
                <Row label="Tax" value={formatMoney(order.taxMinor)} />
                <Row label="Delivery fee" value={order.deliveryFeeMinor === 0 ? "Free" : formatMoney(order.deliveryFeeMinor)} />
                <Row label="Total" value={formatMoney(order.totalMinor)} strong />
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-base font-semibold">Status history</h3>
              <ol className="space-y-3 border-l-2 border-line pl-4">
                {order.history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-ink-2" aria-hidden />
                    <p className="font-medium">{STATUS_META[h.status].label}</p>
                    <p className="num text-xs text-ink-2">{formatDateTime(h.at)} · {h.actor}</p>
                    {h.reason && <p className="text-xs text-ink-2">Reason: {h.reason}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Drawer>

      <Drawer
        side="center"
        open={!!pending}
        onClose={() => { setPending(null); setReason(""); }}
        title={pending ? `${pending.label}?` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPending(null); setReason(""); }}>Keep order</Button>
            <Button variant="primary" onClick={confirm}>{pending?.label}</Button>
          </>
        }
      >
        <p className="mb-4 text-ink-2">
          {order?.number} will be marked {pending ? STATUS_META[pending.to].label.toLowerCase() : ""} and the customer will see this in the app. This can’t be undone.
        </p>
        <Field label="Reason (shown in history)">
          {(id) => <textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} py-2`} />}
        </Field>
      </Drawer>
    </>
  );
}
