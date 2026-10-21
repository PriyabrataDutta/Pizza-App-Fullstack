import "server-only";
import { adminClient } from "@/shared/supabase/server";
import { fromDbError } from "./errors";
import type { AttachmentRow, CategoryRow, GroupRow, OptionPriceRow, OptionRow, PortionRow, ProductRow } from "../types";

// Writes and admin-only reads (including hidden items) for the catalog. No business rules here: the service decides, this stores.
// supabase-js has no transactions, so multi-step writes use compensating deletes where a half-written product would be harmful.

type Result<T> = { data: T | null; error: { code?: string; message: string; details?: string | null } | null };

function must<T>(result: Result<T>, what: string): T {
  if (result.error) throw fromDbError(result.error, what);
  return result.data as T;
}

const db = () => adminClient();

// ---- Categories -------------------------------------------------------------------------------------------------------
export const categories = {
  async all(): Promise<(CategoryRow & { product_count: number })[]> {
    const rows = must(await db().from("categories").select("*").order("sort_order").order("name"), "categories") as CategoryRow[];
    const products = must(await db().from("products").select("category_id"), "product counts") as { category_id: string }[];
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    return rows.map((r) => ({ ...r, product_count: counts.get(r.id) ?? 0 }));
  },
  async get(id: string): Promise<CategoryRow | null> {
    return must(await db().from("categories").select("*").eq("id", id).maybeSingle(), "category") as CategoryRow | null;
  },
  async slugs(): Promise<Set<string>> {
    const rows = must(await db().from("categories").select("slug"), "category slugs") as { slug: string }[];
    return new Set(rows.map((r) => r.slug));
  },
  async nextSort(parentId: string | null): Promise<number> {
    let q = db().from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
    const rows = must(await q, "category order") as { sort_order: number }[];
    return (rows[0]?.sort_order ?? 0) + 1;
  },
  async insert(row: Record<string, unknown>): Promise<CategoryRow> {
    return must(await db().from("categories").insert(row).select("*").single(), "create category") as CategoryRow;
  },
  async update(id: string, patch: Record<string, unknown>): Promise<CategoryRow> {
    return must(await db().from("categories").update(patch).eq("id", id).select("*").single(), "update category") as CategoryRow;
  },
  async childCount(id: string): Promise<number> {
    const { count, error } = await db().from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id);
    if (error) throw fromDbError(error, "children");
    return count ?? 0;
  },
  async productCount(id: string): Promise<number> {
    const { count, error } = await db().from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (error) throw fromDbError(error, "products");
    return count ?? 0;
  },
  async remove(id: string): Promise<void> {
    must(await db().from("categories").delete().eq("id", id), "delete category");
  },
  async existingIds(ids: string[]): Promise<Set<string>> {
    const rows = must(await db().from("categories").select("id").in("id", ids), "categories") as { id: string }[];
    return new Set(rows.map((r) => r.id));
  },
  async setSort(id: string, sortOrder: number): Promise<void> {
    must(await db().from("categories").update({ sort_order: sortOrder }).eq("id", id), "reorder category");
  },
};

// ---- Portion templates (size sets a category can offer) ---------------------------------------------------------------
export const portionSets = {
  async all(): Promise<{ id: string; name: string; items: { key: string; label: string; sort_order: number }[] }[]> {
    const sets = must(await db().from("portion_sets").select("id,name").order("name"), "portion sets") as { id: string; name: string }[];
    const items = must(await db().from("portion_set_items").select("set_id,key,label,sort_order").order("sort_order"), "portion set items") as { set_id: string; key: string; label: string; sort_order: number }[];
    return sets.map((s) => ({ ...s, items: items.filter((i) => i.set_id === s.id).map(({ key, label, sort_order }) => ({ key, label, sort_order })) }));
  },
};

// ---- Products ---------------------------------------------------------------------------------------------------------
export interface ProductListFilter { categoryId?: string; search?: string; active?: boolean; offset: number; limit: number }

export const products = {
  async page(f: ProductListFilter): Promise<{ rows: ProductRow[]; hasMore: boolean }> {
    let q = db().from("products").select("*");
    if (f.categoryId) q = q.eq("category_id", f.categoryId);
    if (f.active !== undefined) q = q.eq("is_active", f.active);
    if (f.search) q = q.ilike("name", `%${f.search.replace(/[%_\\,()]/g, " ")}%`);
    const rows = must(await q.order("sort_order").order("name").order("id").range(f.offset, f.offset + f.limit), "products") as ProductRow[];
    return { rows: rows.slice(0, f.limit), hasMore: rows.length > f.limit };
  },
  async get(id: string): Promise<ProductRow | null> {
    return must(await db().from("products").select("*").eq("id", id).maybeSingle(), "product") as ProductRow | null;
  },
  async slugs(): Promise<Set<string>> {
    const rows = must(await db().from("products").select("slug"), "product slugs") as { slug: string }[];
    return new Set(rows.map((r) => r.slug));
  },
  async nextSort(categoryId: string): Promise<number> {
    const rows = must(await db().from("products").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1), "product order") as { sort_order: number }[];
    return (rows[0]?.sort_order ?? 0) + 1;
  },
  async insert(row: Record<string, unknown>): Promise<ProductRow> {
    return must(await db().from("products").insert(row).select("*").single(), "create product") as ProductRow;
  },
  async update(id: string, patch: Record<string, unknown>): Promise<ProductRow> {
    return must(await db().from("products").update(patch).eq("id", id).select("*").single(), "update product") as ProductRow;
  },
  async remove(id: string): Promise<void> {
    must(await db().from("products").delete().eq("id", id), "delete product");
  },
  async portions(productId: string): Promise<PortionRow[]> {
    return must(await db().from("product_portions").select("*").eq("product_id", productId).order("sort_order"), "portions") as PortionRow[];
  },
  async portionsFor(productIds: string[]): Promise<PortionRow[]> {
    if (productIds.length === 0) return [];
    return must(await db().from("product_portions").select("*").in("product_id", productIds).order("sort_order"), "portions") as PortionRow[];
  },
  async replacePortions(productId: string, wanted: { key: string; label: string; price_minor: number; is_available: boolean; sku: string | null }[]): Promise<void> {
    const rows = wanted.map((p, i) => ({ product_id: productId, key: p.key, label: p.label, price_minor: p.price_minor, currency: "EUR", is_available: p.is_available, sku: p.sku, sort_order: i + 1 }));
    must(await db().from("product_portions").upsert(rows, { onConflict: "product_id,key" }), "save portions");
    const keep = wanted.map((p) => p.key);
    const existing = must(await db().from("product_portions").select("id,key").eq("product_id", productId), "portions") as { id: string; key: string }[];
    const stale = existing.filter((e) => !keep.includes(e.key)).map((e) => e.id);
    if (stale.length > 0) must(await db().from("product_portions").delete().in("id", stale), "remove portions");
  },
  async setPortionAvailable(productId: string, key: string, available: boolean): Promise<boolean> {
    const rows = must(await db().from("product_portions").update({ is_available: available }).eq("product_id", productId).eq("key", key).select("id"), "portion") as { id: string }[];
    return rows.length > 0;
  },
  async tagKeys(productId: string): Promise<string[]> {
    const rows = must(await db().from("product_tags").select("tags(key)").eq("product_id", productId), "tags") as unknown as { tags: { key: string } | { key: string }[] | null }[];
    return rows.flatMap((r) => (Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : [])).map((t) => t.key);
  },
  async setTags(productId: string, keys: string[]): Promise<string[]> {
    const wanted = [...new Set(keys)];
    const found = wanted.length === 0 ? [] : (must(await db().from("tags").select("id,key").in("key", wanted), "tags") as { id: string; key: string }[]);
    const missing = wanted.filter((k) => !found.some((f) => f.key === k));
    if (missing.length > 0) return missing;
    must(await db().from("product_tags").delete().eq("product_id", productId), "clear tags");
    if (found.length > 0) must(await db().from("product_tags").insert(found.map((f) => ({ product_id: productId, tag_id: f.id }))), "save tags");
    return [];
  },
};

// ---- Option groups, options, attachments, prices ------------------------------------------------------------------------
export const groups = {
  async all(): Promise<(GroupRow & { option_count: number; attachment_count: number })[]> {
    const rows = must(await db().from("option_groups").select("*").order("name"), "groups") as GroupRow[];
    const options = must(await db().from("options").select("group_id"), "options") as { group_id: string }[];
    const attachments = must(await db().from("group_attachments").select("group_id"), "attachments") as { group_id: string }[];
    const count = (list: { group_id: string }[], id: string) => list.filter((x) => x.group_id === id).length;
    return rows.map((g) => ({ ...g, option_count: count(options, g.id), attachment_count: count(attachments, g.id) }));
  },
  async get(id: string): Promise<GroupRow | null> {
    return must(await db().from("option_groups").select("*").eq("id", id).maybeSingle(), "group") as GroupRow | null;
  },
  async insert(row: Record<string, unknown>): Promise<GroupRow> {
    return must(await db().from("option_groups").insert(row).select("*").single(), "create group") as GroupRow;
  },
  async update(id: string, patch: Record<string, unknown>): Promise<GroupRow> {
    return must(await db().from("option_groups").update(patch).eq("id", id).select("*").single(), "update group") as GroupRow;
  },
  async remove(id: string): Promise<void> {
    must(await db().from("option_groups").delete().eq("id", id), "delete group");
  },
  async attachmentCount(id: string): Promise<number> {
    const { count, error } = await db().from("group_attachments").select("id", { count: "exact", head: true }).eq("group_id", id);
    if (error) throw fromDbError(error, "attachments");
    return count ?? 0;
  },
  async options(groupId: string): Promise<OptionRow[]> {
    return must(await db().from("options").select("*").eq("group_id", groupId).order("sort_order").order("name"), "options") as OptionRow[];
  },
  async replaceOptions(groupId: string, wanted: { id?: string; name: string; default_price_minor: number; is_active: boolean }[]): Promise<OptionRow[]> {
    const existing = await this.options(groupId);
    const keepIds = new Set(wanted.filter((w) => w.id).map((w) => w.id as string));
    const stale = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (stale.length > 0) must(await db().from("options").delete().in("id", stale), "remove options");
    for (const [i, w] of wanted.entries()) {
      const row = { group_id: groupId, name: w.name, default_price_minor: w.default_price_minor, is_active: w.is_active, sort_order: i + 1 };
      if (w.id) must(await db().from("options").update(row).eq("id", w.id).eq("group_id", groupId), "update option");
      else must(await db().from("options").insert(row), "create option");
    }
    return this.options(groupId);
  },
};

export const attachments = {
  async forTarget(scope: "category" | "product", targetId: string): Promise<(AttachmentRow & { prices: OptionPriceRow[] })[]> {
    const column = scope === "category" ? "category_id" : "product_id";
    const rows = must(await db().from("group_attachments").select("*").eq("scope", scope).eq(column, targetId).order("sort_order"), "attachments") as AttachmentRow[];
    const prices = rows.length === 0 ? [] : (must(await db().from("option_prices").select("*").in("attachment_id", rows.map((r) => r.id)), "prices") as OptionPriceRow[]);
    return rows.map((r) => ({ ...r, prices: prices.filter((p) => p.attachment_id === r.id) }));
  },
  async get(id: string): Promise<AttachmentRow | null> {
    return must(await db().from("group_attachments").select("*").eq("id", id).maybeSingle(), "attachment") as AttachmentRow | null;
  },
  async upsert(row: { scope: "category" | "product"; target_id: string; group_id: string; sort_order: number; default_option_id: string | null }): Promise<AttachmentRow> {
    const column = row.scope === "category" ? "category_id" : "product_id";
    const existing = must(await db().from("group_attachments").select("*").eq("scope", row.scope).eq(column, row.target_id).eq("group_id", row.group_id).maybeSingle(), "attachment") as AttachmentRow | null;
    if (existing) {
      return must(await db().from("group_attachments").update({ sort_order: row.sort_order, default_option_id: row.default_option_id }).eq("id", existing.id).select("*").single(), "update attachment") as AttachmentRow;
    }
    return must(await db().from("group_attachments").insert({
      scope: row.scope, [column]: row.target_id, group_id: row.group_id, sort_order: row.sort_order, default_option_id: row.default_option_id,
    }).select("*").single(), "create attachment") as AttachmentRow;
  },
  async replacePrices(attachmentId: string, prices: { option_id: string; portion_key: string | null; price_minor: number }[]): Promise<void> {
    must(await db().from("option_prices").delete().eq("attachment_id", attachmentId), "clear prices");
    for (let i = 0; i < prices.length; i += 500) {
      must(await db().from("option_prices").insert(prices.slice(i, i + 500).map((p) => ({ attachment_id: attachmentId, ...p }))), "save prices");
    }
  },
  async remove(id: string): Promise<void> {
    must(await db().from("group_attachments").delete().eq("id", id), "delete attachment");
  },
};

// ---- Images ---------------------------------------------------------------------------------------------------------------
export const BUCKET = "product-images";

export const storage = {
  async signedUpload(path: string): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Could not prepare the upload: ${error?.message ?? "no data"}`);
    return { signedUrl: data.signedUrl, token: data.token };
  },
};
