import "server-only";
import { AdminError } from "@/modules/catalog/admin/errors";
import { writeAudit } from "@/modules/access/repository";
import { adminClient } from "@/shared/supabase/server";
import { toOrderDto } from "./order-dto";
import { loadBundle } from "./repository";
import type { OrderRow } from "./types";

// Orders for the dashboard: list, read, and move along the lifecycle. The lifecycle itself lives in the database function
// advance_order_status(), which refuses moves it does not allow and writes the history row in the same transaction.

const ALL_STATUSES = ["placed", "accepted", "preparing", "ready_for_dispatch", "out_for_delivery", "delivered", "rejected", "cancelled"];

export async function listOrders(f: { statuses?: string[]; offset: number; limit: number }) {
  if (f.statuses && f.statuses.some((s) => !ALL_STATUSES.includes(s))) throw new AdminError("VALIDATION_ERROR", "Unknown status in the filter.");
  let q = adminClient().from("orders").select("*");
  if (f.statuses && f.statuses.length > 0) q = q.in("status", f.statuses);
  const { data, error } = await q.order("created_at", { ascending: false }).range(f.offset, f.offset + f.limit);
  if (error) throw new Error(`admin orders: ${error.message}`);
  const rows = data as OrderRow[];
  const page = rows.slice(0, f.limit);
  const bundles = await loadBundle(page);
  return { items: bundles.map(toOrderDto), has_more: rows.length > f.limit };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrder(id: string) {
  if (!UUID.test(id)) throw new AdminError("NOT_FOUND", "That order does not exist.");
  const { data, error } = await adminClient().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`admin order: ${error.message}`);
  if (!data) throw new AdminError("NOT_FOUND", "That order does not exist.");
  return toOrderDto((await loadBundle([data as OrderRow]))[0]);
}

export async function changeStatus(actor: { id: string; email: string }, orderId: string, status: string, reason: string | undefined) {
  const { error } = await adminClient().rpc("advance_order_status", {
    p_order: orderId, p_new: status, p_actor_staff: actor.id, p_actor_label: actor.email, p_reason: reason ?? "",
  });
  if (error) {
    const text = error.message ?? "";
    if (text.includes("ORDER_NOT_FOUND")) throw new AdminError("NOT_FOUND", "That order does not exist.");
    if (text.includes("INVALID_TRANSITION")) throw new AdminError("INVALID_TRANSITION", text.replace(/^INVALID_TRANSITION:\s*/, ""));
    if (/invalid input syntax for type uuid/i.test(text)) throw new AdminError("NOT_FOUND", "That order does not exist.");
    throw new Error(`admin order status: ${text}`);
  }
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "order_status_changed", targetId: orderId, details: { status, reason: reason ?? null } });
  return getOrder(orderId);
}

