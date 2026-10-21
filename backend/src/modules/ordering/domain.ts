// Order lifecycle rules. Mirrors docs/order-lifecycle.md.
// The server is the authority on transitions; the UI uses this only to decide which buttons to offer.

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed";
export type PaymentMethod = "cod" | "online_demo";

export interface OrderLine {
  name: string;
  variant: string;
  options: string[];
  quantity: number;
  lineTotalMinor: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  address: string;
  instructions?: string;
  lines: OrderLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  history: { status: OrderStatus; at: string; actor: string; reason?: string }[];
}

/** Lanes on the board, in kitchen order. */
export const BOARD_STAGES: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
];

export const CLOSED_STATUSES: OrderStatus[] = ["delivered", "rejected", "cancelled"];

export type Tone = "warning" | "info" | "success" | "error";

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  placed: { label: "Placed", tone: "warning" },
  accepted: { label: "Accepted", tone: "info" },
  preparing: { label: "Preparing", tone: "warning" },
  ready_for_dispatch: { label: "Ready for dispatch", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
  cancelled: { label: "Cancelled", tone: "error" },
};

export interface Transition {
  to: OrderStatus;
  label: string;
  destructive?: boolean;
}

// Cancellation from accepted/preparing follows the "if policy permits" rule in the lifecycle doc.
// Assumed permitted for the demo; confirm with the business before production.
const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  placed: [
    { to: "accepted", label: "Accept order" },
    { to: "rejected", label: "Reject", destructive: true },
  ],
  accepted: [
    { to: "preparing", label: "Start preparing" },
    { to: "cancelled", label: "Cancel order", destructive: true },
  ],
  preparing: [
    { to: "ready_for_dispatch", label: "Mark ready" },
    { to: "cancelled", label: "Cancel order", destructive: true },
  ],
  ready_for_dispatch: [{ to: "out_for_delivery", label: "Send out for delivery" }],
  out_for_delivery: [{ to: "delivered", label: "Mark delivered" }],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export function nextTransitions(status: OrderStatus): Transition[] {
  return TRANSITIONS[status];
}

export function primaryTransition(status: OrderStatus): Transition | undefined {
  return TRANSITIONS[status].find((t) => !t.destructive);
}

export function destructiveTransition(status: OrderStatus): Transition | undefined {
  return TRANSITIONS[status].find((t) => t.destructive);
}
