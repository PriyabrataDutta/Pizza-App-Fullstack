"use client";

import { Banknote, FlaskConical } from "lucide-react";
import { Button, Pill } from "@/shared/ui";
import { formatMoney, formatTime } from "@/shared/format";
import { primaryTransition, type Order, type OrderStatus } from "./domain";

export function PaymentPill({ order }: { order: Order }) {
  if (order.paymentMethod === "online_demo") {
    return (
      <Pill tone="neutral">
        <FlaskConical className="size-3.5" aria-hidden />
        Demo online · {order.paymentStatus === "paid" ? "paid" : order.paymentStatus}
      </Pill>
    );
  }
  return (
    <Pill tone="neutral">
      <Banknote className="size-3.5" aria-hidden />
      Cash on delivery{order.paymentStatus === "paid" ? " · paid" : ""}
    </Pill>
  );
}

/** A kitchen slip: what to make, who it's for, what to do next. */
export function OrderTicket({ order, onOpen, onAdvance }: {
  order: Order;
  onOpen: (id: string) => void;
  onAdvance?: (id: string, to: OrderStatus) => void;
}) {
  const next = primaryTransition(order.status);
  const itemCount = order.lines.reduce((a, l) => a + l.quantity, 0);
  return (
    <li className="ticket-wrap slip-in">
      <div className="ticket">
        <button
          onClick={() => onOpen(order.id)}
          className="block w-full rounded-t-card px-4 pt-3 text-left hover:bg-subtle/60"
          aria-label={`Open order ${order.number} for ${order.customerName}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="num text-base font-bold">{order.number}</span>
            <span className="num text-xs text-ink-2">{formatTime(order.createdAt)}</span>
          </div>
          <p className="mt-0.5 truncate font-medium">{order.customerName}</p>

          <ul className="mt-2 space-y-1.5 border-t border-dashed border-line pt-2">
            {order.lines.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="num w-6 shrink-0 font-semibold">{l.quantity}×</span>
                <span className="min-w-0">
                  {l.name} <span className="text-ink-2">{l.variant}</span>
                  {l.options.length > 0 && <span className="block text-xs text-ink-2">{l.options.join(", ")}</span>}
                </span>
              </li>
            ))}
          </ul>

          {order.instructions && (
            <p className="mt-2 rounded-control bg-warning-soft px-2 py-1 text-xs text-warning">Note: {order.instructions}</p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 pb-3">
            <span className="text-xs text-ink-2">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            <span className="num text-base font-bold">{formatMoney(order.totalMinor)}</span>
          </div>
        </button>

        <div className="flex flex-col gap-2 px-4">
          <PaymentPill order={order} />
          {next && onAdvance && (
            <Button size="sm" className="w-full" onClick={() => onAdvance(order.id, next.to)}>
              {next.label}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
