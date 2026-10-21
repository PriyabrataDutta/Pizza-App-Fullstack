// Shapes shared by the checkout modules. Row types mirror supabase/migrations/20261020100000_orders.sql.

export interface Customer {
  id: string;
  fullName: string | null;
  phone: string | null;
}

export interface AddressRow {
  id: string;
  customer_id: string;
  label: string;
  line1: string;
  locality: string;
  city: string;
  postal_code: string;
  instructions: string | null;
  is_default: boolean;
}

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  delivery_fee_minor: number;
  total_minor: number;
  coupon_code: string | null;
  estimated_minutes: number | null;
  delivery_label: string;
  delivery_line1: string;
  delivery_locality: string;
  delivery_city: string;
  delivery_postal_code: string;
  delivery_instructions: string | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  portion_key: string;
  product_name: string;
  portion_label: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
}

export interface OrderOptionRow {
  order_item_id: string;
  option_id: string | null;
  group_name: string;
  option_name: string;
  price_minor: number;
}

export interface HistoryRow {
  new_status: string;
  reason: string | null;
  created_at: string;
}

export interface OrderBundle {
  order: OrderRow;
  items: OrderItemRow[];
  options: OrderOptionRow[];
  history: HistoryRow[];
}

/** What `place_order` needs: the finished snapshot, already priced by the server. */
export interface PlaceOrderPayload {
  customer_id: string;
  idempotency_key: string;
  payment_method: "cod" | "online_demo";
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  delivery_fee_minor: number;
  total_minor: number;
  coupon_id: string | null;
  coupon_code: string | null;
  delivery_zone_id: string | null;
  estimated_minutes: number | null;
  address: { label: string; line1: string; locality: string; city: string; postal_code: string; instructions: string | null };
  items: {
    product_id: string;
    portion_key: string;
    product_name: string;
    portion_label: string;
    quantity: number;
    unit_price_minor: number;
    line_total_minor: number;
    options: { option_id: string; group_name: string; option_name: string; price_minor: number }[];
  }[];
}
