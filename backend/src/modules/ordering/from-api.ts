import type { OrderAdmin } from "@/modules/catalog/admin-client";
import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from "./domain";

const STATUSES: OrderStatus[] = ["placed", "accepted", "preparing", "ready_for_dispatch", "out_for_delivery", "delivered", "rejected", "cancelled"];

/** An unknown status from a newer server is shown as "placed" rather than crashing the board; the lifecycle buttons then come from the server's refusal. */
const asStatus = (s: string): OrderStatus => (STATUSES.includes(s as OrderStatus) ? (s as OrderStatus) : "placed");

const asPaymentStatus = (s: string): PaymentStatus => (s === "paid" || s === "demo_paid" ? "paid" : s === "failed" ? "failed" : "pending");

/**
 * Turns an order from the admin API into what the dashboard screens use. Guests give no name or phone yet, so the ticket is
 * identified by the street it goes to; the full address and the customer's delivery note are in the drawer.
 */
export function fromAdminOrder(o: OrderAdmin): Order {
  return {
    id: o.id,
    number: o.number,
    status: asStatus(o.status),
    customerName: `Guest · ${o.delivery.line1}`,
    customerPhone: "",
    address: o.delivery_address,
    instructions: o.delivery.instructions ?? undefined,
    lines: o.lines.map((l) => ({ name: l.name, variant: l.portion, options: l.options, quantity: l.quantity, lineTotalMinor: l.line_total_minor })),
    subtotalMinor: o.subtotal_minor,
    discountMinor: o.discount_minor,
    taxMinor: o.tax_minor,
    deliveryFeeMinor: o.delivery_fee_minor,
    totalMinor: o.total_minor,
    couponCode: o.coupon_code ?? undefined,
    paymentMethod: (o.payment_method === "online_demo" ? "online_demo" : "cod") as PaymentMethod,
    paymentStatus: asPaymentStatus(o.payment_status),
    createdAt: o.created_at,
    history: o.history.map((h) => ({ status: asStatus(h.status), at: h.at, actor: h.actor, reason: h.reason ?? undefined })),
  };
}
