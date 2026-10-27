import type { AddressRow, OrderBundle, OrderRow } from "./types";

// What the app and the dashboard receive for an order. Built from stored rows only (the snapshot), never from the live menu.

export interface OrderLineDto {
  name: string;
  portion: string;
  options: string[];
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
}

export interface OrderSummaryDto {
  id: string;
  number: string;
  status: string;
  total_minor: number;
  currency: string;
  created_at: string;
}

export interface OrderDto extends OrderSummaryDto {
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  delivery_fee_minor: number;
  coupon_code: string | null;
  payment_method: string;
  payment_status: string;
  estimated_minutes: number | null;
  /** The address on one line, for display. */
  delivery_address: string;
  delivery: { label: string; line1: string; locality: string; city: string; postal_code: string; instructions: string | null };
  /** Who to call; null for orders placed before contact details were collected. */
  contact: { name: string | null; phone: string | null };
  lines: OrderLineDto[];
  history: { status: string; at: string; reason: string | null; actor: string }[];
}

export const oneLineAddress = (a: { line1: string; locality: string; city: string; postal_code: string }) =>
  `${a.line1}, ${a.locality}, ${a.postal_code} ${a.city}`;

export const addressDto = (a: AddressRow) => ({
  id: a.id, label: a.label, line1: a.line1, locality: a.locality, city: a.city, postal_code: a.postal_code,
  instructions: a.instructions, is_default: a.is_default, one_line: oneLineAddress(a),
});

export function toOrderSummary(o: OrderRow): OrderSummaryDto {
  return { id: o.id, number: o.order_number, status: o.status, total_minor: o.total_minor, currency: o.currency, created_at: o.created_at };
}

export function toOrderDto({ order: o, items, options, history }: OrderBundle): OrderDto {
  const address = { line1: o.delivery_line1, locality: o.delivery_locality, city: o.delivery_city, postal_code: o.delivery_postal_code };
  return {
    ...toOrderSummary(o),
    subtotal_minor: o.subtotal_minor,
    discount_minor: o.discount_minor,
    tax_minor: o.tax_minor,
    delivery_fee_minor: o.delivery_fee_minor,
    coupon_code: o.coupon_code,
    payment_method: o.payment_method,
    payment_status: o.payment_status,
    estimated_minutes: o.estimated_minutes,
    delivery_address: oneLineAddress(address),
    delivery: { label: o.delivery_label, ...address, instructions: o.delivery_instructions },
    contact: { name: o.contact_name ?? null, phone: o.contact_phone ?? null },
    lines: items.map((i) => ({
      name: i.product_name,
      portion: i.portion_label,
      options: options.filter((x) => x.order_item_id === i.id).map((x) => x.option_name),
      quantity: i.quantity,
      unit_price_minor: i.unit_price_minor,
      line_total_minor: i.line_total_minor,
    })),
    history: [...history].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((h) => ({ status: h.new_status, at: h.created_at, reason: h.reason, actor: h.actor_label })),
  };
}
