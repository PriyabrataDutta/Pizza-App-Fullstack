import "server-only";
import { adminClient } from "@/shared/supabase/server";
import type { CouponRule, ZoneRule } from "./quote";
import { CheckoutError, type CheckoutRepository } from "./service";
import type { AddressRow, Customer, HistoryRow, OrderBundle, OrderItemRow, OrderOptionRow, OrderRow, PlaceOrderPayload } from "./types";

// Storage for checkout. No business rules here: the service decides, this stores. Orders are written only through the
// database function place_order(), which is atomic and idempotent.

type Result<T> = { data: T | null; error: { code?: string; message: string } | null };

function must<T>(result: Result<T>, what: string): T {
  if (result.error) throw new Error(`checkout: ${what}: ${result.error.message}`);
  return result.data as T;
}

const db = () => adminClient();

const CUSTOMER_COLUMNS = "id, full_name, phone, is_blocked";
const LEGACY_CUSTOMER_COLUMNS = "id, full_name, phone"; // before migration 20261027100000 there is no block flag
const customerOf = (r: { id: string; full_name: string | null; phone: string | null; is_blocked?: boolean }): Customer => ({
  id: r.id, fullName: r.full_name, phone: r.phone, isBlocked: r.is_blocked === true,
});

/**
 * True when the database has not had the launch-readiness migrations yet (a table or column is missing). The server is deployed
 * first or second, depending on how a release goes, so for that window it falls back to the old layout instead of failing every
 * sign-in. Once the migrations are applied the fallbacks are never taken.
 */
const schemaMissing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || error.code === "PGRST204" || /does not exist|schema cache/i.test(error.message ?? ""));
const ADDRESS_COLUMNS = "id, customer_id, label, line1, locality, city, postal_code, instructions, is_default";

export async function loadBundle(orderRows: OrderRow[]): Promise<OrderBundle[]> {
  if (orderRows.length === 0) return [];
  const ids = orderRows.map((o) => o.id);
  const items = must(await db().from("order_items").select("*").in("order_id", ids).order("created_at"), "order items") as OrderItemRow[];
  const itemIds = items.map((i) => i.id);
  const options = itemIds.length === 0 ? [] : (must(await db().from("order_item_options").select("*").in("order_item_id", itemIds), "order options") as OrderOptionRow[]);
  const history = must(await db().from("order_status_history").select("order_id, new_status, reason, created_at, actor_label").in("order_id", ids).order("created_at"), "history") as (HistoryRow & { order_id: string })[];
  return orderRows.map((order) => {
    const mine = items.filter((i) => i.order_id === order.id);
    return {
      order,
      items: mine,
      options: options.filter((o) => mine.some((i) => i.id === o.order_item_id)),
      history: history.filter((h) => h.order_id === order.id),
    };
  });
}

export const supabaseCheckoutRepository: CheckoutRepository = {
  // A customer owns one or more devices; each device holds one token (only its hash is stored). customers.token_hash is still written
  // for the first device until the column is retired.
  async createCustomer(tokenHash) {
    let created = await db().from("customers").insert({ token_hash: tokenHash }).select(CUSTOMER_COLUMNS).single();
    if (schemaMissing(created.error)) created = await db().from("customers").insert({ token_hash: tokenHash }).select(LEGACY_CUSTOMER_COLUMNS).single();
    const customer = must(created as Result<Parameters<typeof customerOf>[0]>, "create customer");
    const device = await db().from("customer_devices").insert({ customer_id: customer.id, token_hash: tokenHash });
    if (device.error && !schemaMissing(device.error)) {
      await db().from("customers").delete().eq("id", customer.id); // do not leave a customer nobody can sign in as
      throw new Error(`checkout: create device: ${device.error.message}`);
    }
    return customerOf(customer);
  },

  async customerByTokenHash(hash) {
    const found = await db().from("customer_devices").select(`customers!inner(${CUSTOMER_COLUMNS})`).eq("token_hash", hash).is("revoked_at", null).maybeSingle();
    if (schemaMissing(found.error)) {
      // Not migrated yet: the token is on the customer row itself.
      const legacy = must(await db().from("customers").select(LEGACY_CUSTOMER_COLUMNS).eq("token_hash", hash).maybeSingle(), "find customer");
      return legacy ? customerOf(legacy as never) : null;
    }
    const row = must(found as never, "find customer") as unknown as { customers: Parameters<typeof customerOf>[0] } | null;
    return row ? customerOf(row.customers) : null;
  },

  async touchCustomer(id) {
    const now = new Date().toISOString();
    await db().from("customers").update({ last_seen_at: now }).eq("id", id);
  },

  async saveContact(customerId, name, phone) {
    await db().from("customers").update({ full_name: name, phone }).eq("id", customerId);
  },

  async addresses(customerId) {
    return must(await db().from("customer_addresses").select(ADDRESS_COLUMNS).eq("customer_id", customerId).order("is_default", { ascending: false }).order("created_at"), "addresses") as AddressRow[];
  },

  async address(customerId, id) {
    return (must(await db().from("customer_addresses").select(ADDRESS_COLUMNS).eq("customer_id", customerId).eq("id", id).maybeSingle(), "address") as AddressRow | null) ?? null;
  },

  async insertAddress(customerId, fields) {
    return must(await db().from("customer_addresses").insert({ customer_id: customerId, ...fields }).select(ADDRESS_COLUMNS).single(), "create address") as AddressRow;
  },

  async updateAddress(customerId, id, patch) {
    return (must(await db().from("customer_addresses").update(patch).eq("customer_id", customerId).eq("id", id).select(ADDRESS_COLUMNS).maybeSingle(), "update address") as AddressRow | null) ?? null;
  },

  async deleteAddress(customerId, id) {
    const rows = must(await db().from("customer_addresses").delete().eq("customer_id", customerId).eq("id", id).select("id"), "delete address") as { id: string }[];
    return rows.length > 0;
  },

  async clearDefaultAddress(customerId) {
    must(await db().from("customer_addresses").update({ is_default: false }).eq("customer_id", customerId).eq("is_default", true), "clear default address");
  },

  async zones(): Promise<ZoneRule[]> {
    const rows = must(await db().from("delivery_zones").select("*").eq("is_active", true), "delivery zones") as {
      id: string; name: string; postal_codes: string[]; minimum_order_minor: number; delivery_fee_minor: number; estimated_minutes: number; is_active: boolean;
    }[];
    return rows.map((z) => ({
      id: z.id, name: z.name, postalCodes: z.postal_codes, minimumOrderMinor: Number(z.minimum_order_minor), deliveryFeeMinor: Number(z.delivery_fee_minor),
      estimatedMinutes: z.estimated_minutes, isActive: z.is_active,
    }));
  },

  async couponByCode(code): Promise<CouponRule | null> {
    const r = must(await db().from("coupons").select("*").eq("code", code.toUpperCase()).maybeSingle(), "coupon") as {
      id: string; code: string; discount_type: "fixed" | "percentage"; discount_value: number; minimum_order_minor: number; maximum_discount_minor: number | null;
      starts_at: string | null; expires_at: string | null; is_active: boolean;
    } | null;
    if (!r) return null;
    return {
      id: r.id, code: r.code, discountType: r.discount_type, discountValue: Number(r.discount_value), minimumOrderMinor: Number(r.minimum_order_minor),
      maximumDiscountMinor: r.maximum_discount_minor === null ? null : Number(r.maximum_discount_minor),
      startsAt: r.starts_at ? new Date(r.starts_at) : null, expiresAt: r.expires_at ? new Date(r.expires_at) : null, isActive: r.is_active,
    };
  },

  async placeOrder(payload: PlaceOrderPayload) {
    const { data, error } = await db().rpc("place_order", { p: payload });
    if (error) {
      const text = error.message ?? "";
      if (text.includes("COUPON_LIMIT")) throw new CheckoutError(409, "COUPON_LIMIT", text.replace(/^COUPON_LIMIT:\s*/, ""));
      if (text.includes("COUPON_INVALID")) throw new CheckoutError(400, "COUPON_INVALID", text.replace(/^COUPON_INVALID:\s*/, ""));
      throw new Error(`checkout: place order: ${text}`);
    }
    const result = data as { order_id: string; created: boolean };
    return { orderId: result.order_id, created: result.created };
  },

  async order(customerId, orderId) {
    const row = must(await db().from("orders").select("*").eq("customer_id", customerId).eq("id", orderId).maybeSingle(), "order") as OrderRow | null;
    return row ? (await loadBundle([row]))[0] : null;
  },

  async orderByKey(customerId, key) {
    const row = must(await db().from("orders").select("*").eq("customer_id", customerId).eq("idempotency_key", key).maybeSingle(), "order by key") as OrderRow | null;
    return row ? (await loadBundle([row]))[0] : null;
  },

  async orders(customerId) {
    return must(await db().from("orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50), "orders") as OrderRow[];
  },
};
